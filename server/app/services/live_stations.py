"""Live-stations view: real-time per-device activity for the dashboard.

Derives everything from the devices table + today's inspection_logs (joined to
operators/products/defect types). The firmware does not publish session state,
so the "current session" (operator + product) is inferred from the most recent
inspection on each device. Counts are for the current plant-local day.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.constants import CATEGORY_DISPLAY_NAMES
from app.models.defect import InspectionLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.live import LiveFeedEntry, LiveStation, LiveStationsResponse

_ISO = "%Y-%m-%dT%H:%M:%SZ"
_FEED_LIMIT = 8
# A station counts as "session active" if it logged something this recently.
_SESSION_IDLE_SECONDS = 600
_OTHER_CATEGORY_LABEL = "Saisie libre"


def _iso(value: datetime) -> str:
    return value.strftime(_ISO)


def _plant_tz() -> ZoneInfo:
    return ZoneInfo(settings.plant_tz)


def compute_live(db: Session) -> LiveStationsResponse:
    tz = _plant_tz()
    now = datetime.now(timezone.utc)
    today_local = now.astimezone(tz).date()
    day_lo = _iso(datetime.combine(today_local, time.min, tzinfo=tz).astimezone(timezone.utc))
    hour_ago = _iso(now - timedelta(hours=1))
    active_cutoff = _iso(now - timedelta(seconds=_SESSION_IDLE_SECONDS))

    devices = db.query(Device).filter(Device.active.is_(True)).order_by(Device.id).all()

    # Today's rows for every device in one query (newest first), with the
    # labels the feed needs. outerjoin so OK rows (no defect_type) still come.
    rows = (
        db.query(
            InspectionLog,
            DefectType.label.label("defect_label"),
            DefectType.is_other_fallback.label("is_other"),
            Operator.name.label("operator_name"),
            Product.name.label("product_name"),
        )
        .outerjoin(DefectType, InspectionLog.defect_type_id == DefectType.id)
        .outerjoin(Operator, InspectionLog.operator_id == Operator.id)
        .outerjoin(Product, InspectionLog.product_id == Product.id)
        .filter(InspectionLog.logged_at >= day_lo)
        .order_by(InspectionLog.logged_at.desc(), InspectionLog.id.desc())
        .all()
    )

    by_device: dict[str, list] = {}
    for row in rows:
        by_device.setdefault(row[0].device_id, []).append(row)

    stations = [
        _build_station(dev, by_device.get(dev.id, []), hour_ago, active_cutoff)
        for dev in devices
    ]
    return LiveStationsResponse(updated_at=_iso(now), stations=stations)


def _build_station(dev: Device, drows: list, hour_ago: str, active_cutoff: str) -> LiveStation:
    """drows are this device's rows for today, newest first."""
    parts: set = set()
    part_has_defect: dict = {}
    defect_count = 0
    last_hour_defects = 0
    feed: list[LiveFeedEntry] = []

    for log, defect_label, is_other, operator_name, product_name in drows:
        pid = log.part_inspection_id or f"row{log.id}"
        parts.add(pid)
        is_defect = log.outcome == "DEFECT"
        part_has_defect[pid] = part_has_defect.get(pid, False) or is_defect
        if is_defect:
            defect_count += 1
            if log.logged_at >= hour_ago:
                last_hour_defects += 1
            if len(feed) < _FEED_LIMIT:
                category = (
                    _OTHER_CATEGORY_LABEL if is_other
                    else CATEGORY_DISPLAY_NAMES.get(log.category_kind, log.category_kind or "")
                )
                feed.append(LiveFeedEntry(
                    id=log.id,
                    label=defect_label or "Défaut",
                    category=category,
                    note=log.note,
                    logged_at=log.logged_at,
                    is_other=bool(is_other),
                ))

    ok_count = sum(1 for pid in parts if not part_has_defect.get(pid))
    newest = drows[0][0] if drows else None
    session_active = bool(dev.online and newest and newest.logged_at >= active_cutoff)

    return LiveStation(
        device_id=dev.id,
        online=dev.online,
        last_seen=dev.last_seen,
        session_active=session_active,
        operator_id=newest.operator_id if newest else None,
        operator_name=(drows[0][3] if drows else None),
        product_id=newest.product_id if newest else None,
        product_name=(drows[0][4] if drows else None),
        session_started_at=(drows[-1][0].logged_at if drows else None),
        defect_count=defect_count,
        ok_count=ok_count,
        today_count=len(parts),
        last_hour_defects=last_hour_defects,
        feed=feed,
    )
