import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterator, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.models.defect import InspectionLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.log import HourlyReport, HourlyRow, LogList, LogRead
from app.schemas.log import _DefectTypeRef, _OperatorRef, _ProductRef
from app.constants import CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION

_MAX_PER_PAGE = 200
_ISO = "%Y-%m-%dT%H:%M:%SZ"


def _plant_tz() -> ZoneInfo:
    return ZoneInfo(settings.plant_tz)


def _parse_utc(value: str) -> datetime:
    """Parse a stored UTC timestamp ('YYYY-MM-DDTHH:MM:SSZ') into an aware datetime."""
    try:
        return datetime.strptime(value, _ISO).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _local_day_start_utc(d: date) -> str:
    """UTC instant ('...Z') at which the given plant-local calendar day begins."""
    return (
        datetime.combine(d, time.min, tzinfo=_plant_tz())
        .astimezone(timezone.utc)
        .strftime(_ISO)
    )


def _date_filter_bounds(from_: Optional[str], to: Optional[str]):
    """Translate dashboard date filters (plant-local 'YYYY-MM-DD') into a UTC
    window. `from` is inclusive at local 00:00; `to` is inclusive of the whole
    local day (via an exclusive next-day start) -- without this, comparing a
    full timestamp against a bare date string drops the entire `to` day. Full
    ISO timestamps passed directly are used as-is (upper bound inclusive)."""
    lo = hi = None
    hi_exclusive = True
    if from_:
        lo = _local_day_start_utc(date.fromisoformat(from_)) if len(from_) == 10 else from_
    if to:
        if len(to) == 10:
            hi = _local_day_start_utc(date.fromisoformat(to) + timedelta(days=1))
        else:
            hi, hi_exclusive = to, False
    return lo, hi, hi_exclusive


def _base_query(
    db: Session,
    from_: Optional[str],
    to: Optional[str],
    operator_id: Optional[int],
    defect_type_id: Optional[int],
    device_id: Optional[str],
    product_id: Optional[int],
    outcome: Optional[str] = None,
):
    q = (
        db.query(
            InspectionLog,
            Operator.name.label("operator_name"),
            DefectType.label.label("defect_label"),
            DefectType.category_kind.label("category_kind"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
        )
        .join(Operator, InspectionLog.operator_id == Operator.id)
        .outerjoin(DefectType, InspectionLog.defect_type_id == DefectType.id)
        .join(Product, InspectionLog.product_id == Product.id)
    )
    lo, hi, hi_exclusive = _date_filter_bounds(from_, to)
    if lo:
        q = q.filter(InspectionLog.logged_at >= lo)
    if hi:
        q = q.filter(InspectionLog.logged_at < hi if hi_exclusive else InspectionLog.logged_at <= hi)
    if operator_id is not None:
        q = q.filter(InspectionLog.operator_id == operator_id)
    if defect_type_id is not None:
        q = q.filter(InspectionLog.defect_type_id == defect_type_id)
    if device_id:
        q = q.filter(InspectionLog.device_id == device_id)
    if product_id is not None:
        q = q.filter(InspectionLog.product_id == product_id)
    if outcome:
        q = q.filter(InspectionLog.outcome == outcome)
    return q.order_by(InspectionLog.logged_at.desc())


def _row_to_read(row) -> LogRead:
    log, op_name, defect_label, category_kind, prod_id, prod_name = row
    defect_type = None
    if defect_label is not None:
        defect_type = _DefectTypeRef(
            id=log.defect_type_id,
            label=defect_label,
            category_kind=category_kind,
        )
    return LogRead(
        id=log.id,
        device_id=log.device_id,
        operator=_OperatorRef(id=log.operator_id, name=op_name),
        defect_type=defect_type,
        product=_ProductRef(id=prod_id, name=prod_name),
        outcome=log.outcome,
        note=log.note,
        logged_at=log.logged_at,
        received_at=log.received_at,
    )


def get_list(
    db: Session,
    from_: Optional[str] = None,
    to: Optional[str] = None,
    operator_id: Optional[int] = None,
    defect_type_id: Optional[int] = None,
    device_id: Optional[str] = None,
    product_id: Optional[int] = None,
    outcome: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> LogList:
    per_page = min(per_page, _MAX_PER_PAGE)
    q = _base_query(db, from_, to, operator_id, defect_type_id, device_id, product_id, outcome)
    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()
    return LogList(
        total=total,
        page=page,
        per_page=per_page,
        items=[_row_to_read(r) for r in rows],
    )


def iter_csv_rows(
    db: Session,
    from_: Optional[str] = None,
    to: Optional[str] = None,
    operator_id: Optional[int] = None,
    defect_type_id: Optional[int] = None,
    device_id: Optional[str] = None,
    product_id: Optional[int] = None,
    outcome: Optional[str] = None,
) -> Iterator[str]:
    header = [
        "id", "device_id", "operator_id", "operator_name",
        "outcome", "defect_type_id", "defect_label", "category_kind",
        "product_id", "product_name", "note", "logged_at", "received_at",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    yield buf.getvalue()

    q = _base_query(db, from_, to, operator_id, defect_type_id, device_id, product_id, outcome)
    for row in q.yield_per(500):
        log, op_name, defect_label, category_kind, prod_id, prod_name = row
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow([
            log.id, log.device_id, log.operator_id, op_name,
            log.outcome, log.defect_type_id, defect_label, category_kind,
            prod_id, prod_name, log.note, log.logged_at, log.received_at,
        ])
        yield buf.getvalue()


def compute_hourly_rates(db: Session, report_date: Optional[date] = None) -> HourlyReport:
    """24-row hourly NC-rate report for the given plant-local date (defaults to
    today in the plant timezone). Rows are stored in UTC and bucketed by their
    plant-local hour, so the chart matches the wall clock on the floor."""
    tz = _plant_tz()
    if report_date is None:
        report_date = datetime.now(tz).date()
    date_str = report_date.isoformat()

    # Pull the rows whose UTC instant falls inside the plant-local day.
    lo = _local_day_start_utc(report_date)
    hi = _local_day_start_utc(report_date + timedelta(days=1))

    # Per-part model: each row carries category_kind directly and a
    # part_inspection_id shared by the rows from one part. Taux NC counts
    # *parts*, so a part with several defects in a category counts once. Legacy
    # rows (category_kind NULL) are excluded.
    rows = (
        db.query(
            InspectionLog.logged_at.label("logged_at"),
            InspectionLog.category_kind.label("category_kind"),
            InspectionLog.outcome.label("outcome"),
            InspectionLog.part_inspection_id.label("part_id"),
            InspectionLog.id.label("row_id"),
        )
        .filter(InspectionLog.logged_at >= lo, InspectionLog.logged_at < hi)
        .filter(InspectionLog.category_kind.isnot(None))
        .all()
    )

    # {hour: {category: {"parts": set(part_id), "nc": set(part_id)}}}
    acc: dict[int, dict] = {h: {} for h in range(24)}
    for r in rows:
        hour = _parse_utc(r.logged_at).astimezone(tz).hour
        bucket = acc[hour].setdefault(r.category_kind, {"parts": set(), "nc": set()})
        # Fall back to the row id if a part id is somehow missing.
        pid = r.part_id if r.part_id is not None else f"row{r.row_id}"
        bucket["parts"].add(pid)
        if r.outcome == "DEFECT":
            bucket["nc"].add(pid)

    hourly_rows: list[HourlyRow] = []
    for h in range(24):
        b = acc[h]
        pmp = b.get(CATEGORY_KIND_PMP, {"parts": set(), "nc": set()})
        inj = b.get(CATEGORY_KIND_INJECTION, {"parts": set(), "nc": set()})

        pmp_total = len(pmp["parts"])      # parts inspected for PMP
        pmp_defects = len(pmp["nc"])       # non-conforming parts (>=1 PMP defect)
        inj_total = len(inj["parts"])
        inj_defects = len(inj["nc"])

        hourly_rows.append(HourlyRow(
            hour=h,
            pmp_total=pmp_total,
            pmp_defects=pmp_defects,
            pmp_rate=round(pmp_defects / pmp_total, 4) if pmp_total else 0.0,
            inj_total=inj_total,
            inj_defects=inj_defects,
            inj_rate=round(inj_defects / inj_total, 4) if inj_total else 0.0,
        ))

    return HourlyReport(date=date_str, rows=hourly_rows)
