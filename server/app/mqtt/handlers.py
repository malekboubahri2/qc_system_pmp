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


@register("qc/device/+/defect")
def _handle_defect(topic: str, payload: dict) -> None:
    from app.db import SessionLocal
    from app.models.defect import DefectLog
    from app.mqtt.schemas import DefectPayload, SCHEMA_VERSION_DEFECT

    try:
        data = DefectPayload.model_validate(payload)
    except Exception as exc:
        logger.warning("MQTT defect payload invalid topic={} err={}", topic, exc)
        return
    if data.schema_version != SCHEMA_VERSION_DEFECT:
        logger.warning("MQTT defect unknown schema_version={}", data.schema_version)
        return

    db = SessionLocal()
    try:
        db.add(DefectLog(
            device_id=data.device_id,
            operator_id=data.operator_id,
            defect_type_id=data.defect_type_id,
            product_ref=data.product_ref,
            logged_at=data.logged_at,
        ))
        db.commit()
        logger.info("defect logged device_id={} type_id={}", data.device_id, data.defect_type_id)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
