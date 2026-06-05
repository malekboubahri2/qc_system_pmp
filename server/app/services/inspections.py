"""Inspection ingest — the single place a full part inspection is recorded.

Both the REST endpoint (`POST /inspections`, used by the web PWA) and the MQTT
handler (legacy device path) call `record_part`, so the schema-4 part model is
transport-agnostic (ADR-016/017). One part expands into `inspection_logs` rows:
one per selected defect, or one OK row for an empty category, each stamped with
an explicit `category_kind` and a shared `part_inspection_id`.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from app.constants import CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION
from app.models.defect import InspectionLog, DefectType
from app.models.device import Device


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def record_part(
    db: Session,
    *,
    device_id: str,
    operator_id: int,
    product_id: int,
    pmp_defect_type_ids: list[int],
    inj_defect_type_ids: list[int],
    note: Optional[str] = None,
    logged_at: Optional[str] = None,
) -> str:
    """Record one full part inspection and commit. Returns the part_inspection_id.

    `logged_at` (device/client wall-clock, UTC ISO) is honoured when present;
    otherwise server receipt time is used (correct for offline-queued parts that
    drain later carrying their original time). The free-text `note` is attached
    only to the selected "Autre" fallback defect rows. Raises on DB error; the
    caller owns rollback/close.
    """
    part_id = uuid.uuid4().hex
    received = _utc_now()
    logged = logged_at or received

    # Self-register the device/station so the device_id FK resolves, and refresh
    # its presence on every inspection (not only on first sight).
    device = db.get(Device, device_id)
    if device is None:
        db.add(Device(id=device_id, last_seen=received))
        db.flush()
    else:
        device.last_seen = received

    all_ids = list(pmp_defect_type_ids) + list(inj_defect_type_ids)
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
                    device_id=device_id, operator_id=operator_id,
                    product_id=product_id, defect_type_id=did,
                    outcome="DEFECT", category_kind=category,
                    note=(note if did in other_ids else None),
                    logged_at=logged, part_inspection_id=part_id,
                ))
        else:
            db.add(InspectionLog(
                device_id=device_id, operator_id=operator_id,
                product_id=product_id, defect_type_id=None,
                outcome="OK", category_kind=category,
                note=None, logged_at=logged, part_inspection_id=part_id,
            ))

    add_category(pmp_defect_type_ids, CATEGORY_KIND_PMP)
    add_category(inj_defect_type_ids, CATEGORY_KIND_INJECTION)
    db.commit()

    logger.info(
        "part inspection recorded device={} part={} pmp={} inj={}",
        device_id, part_id, len(pmp_defect_type_ids), len(inj_defect_type_ids),
    )

    # Nudge connected dashboards to refetch (no data, just a signal).
    from app.events import publish
    publish("inspection", {"device_id": device_id})

    return part_id
