"""KPI snapshot: the andon board's "taux NC / inspected parts" big numbers.

Aggregates a single plant-local day from `inspection_logs`. Everything is
counted per *part* (one full inspection, grouped by `part_inspection_id`), so a
part with three defects still counts as one inspected part and one NC part.
"""
from datetime import date as date_cls, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.models.defect import InspectionLog
from app.schemas.kpi import KpiSnapshot

_ISO = "%Y-%m-%dT%H:%M:%SZ"
_DEFECT = "DEFECT"


def _iso(value: datetime) -> str:
    return value.strftime(_ISO)


def compute_kpi(
    db: Session,
    *,
    day: Optional[date_cls] = None,
    product_id: Optional[int] = None,
    operator_id: Optional[int] = None,
) -> KpiSnapshot:
    tz = ZoneInfo(settings.plant_tz)
    now = datetime.now(timezone.utc)
    target = day or now.astimezone(tz).date()

    day_lo = datetime.combine(target, time.min, tzinfo=tz).astimezone(timezone.utc)
    lo = _iso(day_lo)
    hi = _iso(day_lo + timedelta(days=1))
    hour_ago = _iso(now - timedelta(hours=1))

    q = db.query(
        InspectionLog.id,
        InspectionLog.part_inspection_id,
        InspectionLog.outcome,
        InspectionLog.logged_at,
    ).filter(InspectionLog.logged_at >= lo, InspectionLog.logged_at < hi)
    if product_id is not None:
        q = q.filter(InspectionLog.product_id == product_id)
    if operator_id is not None:
        q = q.filter(InspectionLog.operator_id == operator_id)

    parts: set[str] = set()
    nc_parts: set[str] = set()
    last_hour_parts: set[str] = set()
    defect_count = 0

    for row_id, part_id, outcome, logged_at in q.all():
        key = part_id or f"row{row_id}"  # legacy schema-3 rows have no part id
        parts.add(key)
        if logged_at >= hour_ago:
            last_hour_parts.add(key)
        if outcome == _DEFECT:
            defect_count += 1
            nc_parts.add(key)

    inspected = len(parts)
    nc = len(nc_parts)
    nc_rate = round(nc / inspected, 4) if inspected else 0.0

    return KpiSnapshot(
        date=target.isoformat(),
        inspected_parts=inspected,
        nc_parts=nc,
        ok_parts=inspected - nc,
        nc_rate=nc_rate,
        defect_count=defect_count,
        last_hour_parts=len(last_hour_parts),
        updated_at=_iso(now),
    )
