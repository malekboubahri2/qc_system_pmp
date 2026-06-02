import json
from datetime import datetime, timezone
from typing import Callable
from loguru import logger
import paho.mqtt.client as mqtt

HandlerFn = Callable[[str, dict], None]
_handlers: dict[str, HandlerFn] = {}


def _topic_matches(pattern: str, topic: str) -> bool:
    p, t = pattern.split("/"), topic.split("/")
    if len(p) != len(t) and p[-1] != "#":
        return False
    for pp, tp in zip(p, t):
        if pp == "#":
            return True
        if pp != "+" and pp != tp:
            return False
    return len(p) == len(t)


def register(pattern: str):
    def decorator(fn):
        _handlers[pattern] = fn
        return fn
    return decorator


def dispatch(msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload.decode())
    except Exception as exc:
        logger.warning("MQTT bad payload topic={} err={}", msg.topic, exc)
        return
    for pattern, handler in _handlers.items():
        if _topic_matches(pattern, msg.topic):
            try:
                handler(msg.topic, payload)
            except Exception:
                logger.exception("MQTT handler error topic={}", msg.topic)
            return
    logger.debug("MQTT no handler for topic={}", msg.topic)


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@register("qc/device/+/status")
def _handle_status(topic: str, payload: dict) -> None:
    from app.db import SessionLocal
    from app.models.device import Device
    from app.mqtt.schemas import StatusPayload, SCHEMA_VERSION_STATUS

    try:
        data = StatusPayload.model_validate(payload)
    except Exception as exc:
        logger.warning("MQTT status payload invalid topic={} err={}", topic, exc)
        return
    if data.schema_version != SCHEMA_VERSION_STATUS:
        logger.warning("MQTT status unknown schema_version={}", data.schema_version)
        return

    db = SessionLocal()
    try:
        device = db.get(Device, data.device_id)
        if device is None:
            device = Device(
                id=data.device_id,
                config_version=data.config_version,
                operator_version=data.operator_version,
                last_seen=_utc_now(),
            )
            db.add(device)
        else:
            device.config_version = data.config_version
            device.operator_version = data.operator_version
            device.last_seen = _utc_now()
            device.active = True
        db.commit()
        logger.debug("device status upserted device_id={}", data.device_id)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@register("qc/device/+/inspection")
def _handle_inspection(topic: str, payload: dict) -> None:
    from app.mqtt.schemas import SCHEMA_VERSION_INSPECTION, SCHEMA_VERSION_PART_INSPECTION

    schema = payload.get("schema_version")
    if schema == SCHEMA_VERSION_PART_INSPECTION:
        _handle_part_inspection(topic, payload)
    elif schema == SCHEMA_VERSION_INSPECTION:
        _handle_single_inspection(topic, payload)
    else:
        logger.warning("MQTT inspection unknown schema_version={} topic={}", schema, topic)


def _handle_part_inspection(topic: str, payload: dict) -> None:
    """schema_version 4: one full part (PMP + INJ) → expand to inspection_logs
    rows, each with an explicit category_kind and a shared part_inspection_id."""
    import uuid
    from app.db import SessionLocal
    from app.models.defect import InspectionLog, DefectType
    from app.models.device import Device
    from app.mqtt.schemas import PartInspectionPayload
    from app.constants import CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION

    try:
        data = PartInspectionPayload.model_validate(payload)
    except Exception as exc:
        logger.warning("MQTT part inspection invalid topic={} err={}", topic, exc)
        return

    part_id = uuid.uuid4().hex
    received = _utc_now()
    # Honour the device's own timestamp when it has a synced clock; otherwise
    # fall back to server receipt time (also correct for offline-queued parts
    # that drain later but carry their original logged_at).
    logged = data.logged_at or received
    db = SessionLocal()
    try:
        # Self-register the device so the device_id FK resolves.
        if db.get(Device, data.device_id) is None:
            db.add(Device(id=data.device_id, last_seen=received))
            db.flush()

        # The free-text note belongs to the "Autre" fallback type(s) selected.
        all_ids = list(data.pmp_defect_type_ids) + list(data.inj_defect_type_ids)
        other_ids: set[int] = set()
        if all_ids:
            for (did,) in db.query(DefectType.id).filter(
                DefectType.id.in_(all_ids), DefectType.is_other_fallback.is_(True)
            ):
                other_ids.add(did)

        def add_category(defect_ids: list[int], category: str) -> None:
            if defect_ids:
                for did in defect_ids:
                    db.add(InspectionLog(
                        device_id=data.device_id, operator_id=data.operator_id,
                        product_id=data.product_id, defect_type_id=did,
                        outcome="DEFECT", category_kind=category,
                        note=(data.note if did in other_ids else None),
                        logged_at=logged, part_inspection_id=part_id,
                    ))
            else:
                db.add(InspectionLog(
                    device_id=data.device_id, operator_id=data.operator_id,
                    product_id=data.product_id, defect_type_id=None,
                    outcome="OK", category_kind=category,
                    note=None, logged_at=logged, part_inspection_id=part_id,
                ))

        add_category(data.pmp_defect_type_ids, CATEGORY_KIND_PMP)
        add_category(data.inj_defect_type_ids, CATEGORY_KIND_INJECTION)
        db.commit()
        logger.info(
            "part inspection logged device={} part={} pmp={} inj={}",
            data.device_id, part_id,
            len(data.pmp_defect_type_ids), len(data.inj_defect_type_ids),
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _handle_single_inspection(topic: str, payload: dict) -> None:
    """Legacy schema_version 3 (single tap). Kept for backward compatibility."""
    from app.db import SessionLocal
    from app.models.defect import InspectionLog, DefectType
    from app.models.device import Device
    from app.mqtt.schemas import InspectionPayload

    try:
        data = InspectionPayload.model_validate(payload)
    except Exception as exc:
        logger.warning("MQTT inspection payload invalid topic={} err={}", topic, exc)
        return
    if data.outcome == "DEFECT" and data.defect_type_id is None:
        logger.warning("MQTT inspection DEFECT outcome missing defect_type_id topic={}", topic)
        return

    db = SessionLocal()
    try:
        if db.get(Device, data.device_id) is None:
            db.add(Device(id=data.device_id, last_seen=_utc_now()))
            db.flush()
        category = None
        if data.defect_type_id is not None:
            dt = db.get(DefectType, data.defect_type_id)
            category = dt.category_kind if dt else None
        db.add(InspectionLog(
            device_id=data.device_id,
            operator_id=data.operator_id,
            defect_type_id=data.defect_type_id,
            product_id=data.product_id,
            outcome=data.outcome,
            note=data.note,
            category_kind=category,
            logged_at=data.logged_at or _utc_now(),
        ))
        db.commit()
        logger.info(
            "inspection logged device_id={} outcome={} type_id={}",
            data.device_id, data.outcome, data.defect_type_id,
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@register("qc/device/+/defect")
def _handle_defect_legacy(topic: str, payload: dict) -> None:
    """Legacy handler for schema_version 2 devices. Logs a warning and discards."""
    schema_version = payload.get("schema_version")
    logger.warning(
        "MQTT received legacy defect topic (schema_version={}); "
        "device must upgrade to qc/device/+/inspection (schema_version=3). topic={}",
        schema_version, topic,
    )


@register("qc/device/+/session")
def _handle_session(topic: str, payload: dict) -> None:
    from app.mqtt.schemas import SessionPayload, SCHEMA_VERSION_SESSION

    try:
        data = SessionPayload.model_validate(payload)
    except Exception as exc:
        logger.warning("MQTT session payload invalid topic={} err={}", topic, exc)
        return
    if data.schema_version != SCHEMA_VERSION_SESSION:
        logger.warning("MQTT session unknown schema_version={}", data.schema_version)
        return

    logger.info(
        "session started device_id={} operator_id={} product_id={}",
        data.device_id, data.operator_id, data.product_id,
    )
