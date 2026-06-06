"""Andon KPI board snapshot (ADR-020).

One bounded, fixed-shape payload for the wall board: a global block (reusing the
`kpi` snapshot), the busiest products (reusing the `live_products` aggregation),
and today's trending defects with each one's share of all defects. Caps keep it
small enough for the ESP-01's JSON parse and the firmware's fixed buffers.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.defect import InspectionLog, DefectType
from app.schemas.kpi_board import KpiBoardDefect, KpiBoardProduct, KpiBoardResponse
from app.services import kpi as kpi_svc
from app.services import live_products as live_svc

_ISO = "%Y-%m-%dT%H:%M:%SZ"
_DEFECT = "DEFECT"
MAX_PRODUCTS = 4
MAX_DEFECTS = 4


def _iso(value: datetime) -> str:
    return value.strftime(_ISO)


def compute_board(db: Session) -> KpiBoardResponse:
    snap = kpi_svc.compute_kpi(db)                      # today, global
    live = live_svc.compute_live_products(db)           # active/busiest first

    products = [
        KpiBoardProduct(name=p.product_name, parts=p.parts_today, nc_rate=p.nc_rate)
        for p in live.products[:MAX_PRODUCTS]
    ]
    defects = _top_defects(db)

    return KpiBoardResponse(
        updated_at=snap.updated_at,
        date=snap.date,
        nc_rate=snap.nc_rate,
        inspected_parts=snap.inspected_parts,
        nc_parts=snap.nc_parts,
        ok_parts=snap.ok_parts,
        products=products,
        defects=defects,
    )


def _top_defects(db: Session) -> list[KpiBoardDefect]:
    """Today's defects by count (desc), each with its share of all defects."""
    tz = ZoneInfo(settings.plant_tz)
    today = datetime.now(timezone.utc).astimezone(tz).date()
    midnight = datetime.combine(today, time.min, tzinfo=tz)
    day_lo = _iso(midnight.astimezone(timezone.utc))
    day_hi = _iso((midnight + timedelta(days=1)).astimezone(timezone.utc))

    rows = (
        db.query(DefectType.label, func.count(InspectionLog.id))
        .join(DefectType, InspectionLog.defect_type_id == DefectType.id)
        .filter(InspectionLog.logged_at >= day_lo, InspectionLog.logged_at < day_hi)
        .filter(InspectionLog.outcome == _DEFECT)
        .group_by(InspectionLog.defect_type_id, DefectType.label)
        .order_by(func.count(InspectionLog.id).desc(), DefectType.label)
        .all()
    )
    total = sum(count for _, count in rows)
    return [
        KpiBoardDefect(
            label=label,
            count=count,
            ratio=round(count / total, 4) if total else 0.0,
        )
        for label, count in rows[:MAX_DEFECTS]
    ]
