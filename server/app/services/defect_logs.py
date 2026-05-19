import csv
import io
from typing import Iterator, Optional

from sqlalchemy.orm import Session

from app.models.defect import DefectLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.log import LogList, LogRead, _DefectTypeRef, _OperatorRef, _ProductRef

_MAX_PER_PAGE = 200


def _base_query(
    db: Session,
    from_: Optional[str],
    to: Optional[str],
    operator_id: Optional[int],
    defect_type_id: Optional[int],
    device_id: Optional[str],
    product_id: Optional[int],
):
    q = (
        db.query(
            DefectLog,
            Operator.name.label("operator_name"),
            DefectType.label.label("defect_label"),
            DefectType.category_kind.label("category_kind"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
        )
        .join(Operator, DefectLog.operator_id == Operator.id)
        .join(DefectType, DefectLog.defect_type_id == DefectType.id)
        .join(Product, DefectLog.product_id == Product.id)
    )
    if from_:
        q = q.filter(DefectLog.logged_at >= from_)
    if to:
        q = q.filter(DefectLog.logged_at <= to)
    if operator_id is not None:
        q = q.filter(DefectLog.operator_id == operator_id)
    if defect_type_id is not None:
        q = q.filter(DefectLog.defect_type_id == defect_type_id)
    if device_id:
        q = q.filter(DefectLog.device_id == device_id)
    if product_id is not None:
        q = q.filter(DefectLog.product_id == product_id)
    return q.order_by(DefectLog.logged_at.desc())


def _row_to_read(row) -> LogRead:
    log, op_name, defect_label, category_kind, prod_id, prod_name = row
    return LogRead(
        id=log.id,
        device_id=log.device_id,
        operator=_OperatorRef(id=log.operator_id, name=op_name),
        defect_type=_DefectTypeRef(
            id=log.defect_type_id,
            label=defect_label,
            category_kind=category_kind,
        ),
        product=_ProductRef(id=prod_id, name=prod_name),
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
    page: int = 1,
    per_page: int = 50,
) -> LogList:
    per_page = min(per_page, _MAX_PER_PAGE)
    q = _base_query(db, from_, to, operator_id, defect_type_id, device_id, product_id)
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
) -> Iterator[str]:
    header = [
        "id", "device_id", "operator_id", "operator_name",
        "defect_type_id", "defect_label", "category_kind",
        "product_id", "product_name", "note", "logged_at", "received_at",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    yield buf.getvalue()

    q = _base_query(db, from_, to, operator_id, defect_type_id, device_id, product_id)
    for row in q.yield_per(500):
        log, op_name, defect_label, category_kind, prod_id, prod_name = row
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow([
            log.id, log.device_id, log.operator_id, op_name,
            log.defect_type_id, defect_label, category_kind,
            prod_id, prod_name, log.note, log.logged_at, log.received_at,
        ])
        yield buf.getvalue()
