import csv
import io
from datetime import date, datetime, timezone
from typing import Iterator, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.defect import InspectionLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.log import HourlyReport, HourlyRow, LogList, LogRead
from app.schemas.log import _DefectTypeRef, _OperatorRef, _ProductRef
from app.constants import CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION

_MAX_PER_PAGE = 200


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
    if from_:
        q = q.filter(InspectionLog.logged_at >= from_)
    if to:
        q = q.filter(InspectionLog.logged_at <= to)
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
    """Return a 24-row hourly NC-rate report for the given date (UTC, defaults to today)."""
    if report_date is None:
        report_date = datetime.now(timezone.utc).date()
    date_str = report_date.isoformat()

    # Count total and defect inspections per (hour, category_kind) for the date.
    # OK inspections have no defect_type, so we left-join and filter by category via DefectType.
    # For OK rows category_kind is NULL — they count as totals for ALL categories.
    rows = (
        db.query(
            func.strftime("%H", InspectionLog.logged_at).label("hour_str"),
            DefectType.category_kind.label("category_kind"),
            InspectionLog.outcome.label("outcome"),
            func.count().label("cnt"),
        )
        .outerjoin(DefectType, InspectionLog.defect_type_id == DefectType.id)
        .filter(func.strftime("%Y-%m-%d", InspectionLog.logged_at) == date_str)
        .group_by("hour_str", "category_kind", "outcome")
        .all()
    )

    # Accumulate into hour buckets
    # Structure: {hour: {category: {outcome: count}}}
    buckets: dict[int, dict] = {h: {} for h in range(24)}
    for r in rows:
        hour = int(r.hour_str)
        cat = r.category_kind  # may be None for OK rows
        outcome = r.outcome
        cnt = int(r.cnt)

        if cat is None and outcome == "OK":
            # OK with no defect_type — attribute to both categories
            for c in (CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION):
                buckets[hour].setdefault(c, {})
                buckets[hour][c]["OK"] = buckets[hour][c].get("OK", 0) + cnt
        else:
            buckets[hour].setdefault(cat, {})
            buckets[hour][cat][outcome] = buckets[hour][cat].get(outcome, 0) + cnt

    hourly_rows: list[HourlyRow] = []
    for h in range(24):
        b = buckets[h]
        pmp = b.get(CATEGORY_KIND_PMP, {})
        inj = b.get(CATEGORY_KIND_INJECTION, {})

        pmp_defects = pmp.get("DEFECT", 0)
        pmp_ok = pmp.get("OK", 0)
        pmp_total = pmp_defects + pmp_ok

        inj_defects = inj.get("DEFECT", 0)
        inj_ok = inj.get("OK", 0)
        inj_total = inj_defects + inj_ok

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
