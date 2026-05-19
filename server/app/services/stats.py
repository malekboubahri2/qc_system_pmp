from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.defect import DefectLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.stats import ByDefectPoint, ByOperatorPoint, HeatmapPoint, SummaryPoint


def _cutoff(days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def summary(db: Session, days: int = 7, product_id: Optional[int] = None) -> list[SummaryPoint]:
    cut = _cutoff(days)
    q = (
        db.query(
            func.strftime("%Y-%m-%d", DefectLog.logged_at).label("date"),
            func.count().label("cnt"),
        )
        .filter(DefectLog.logged_at >= cut)
    )
    if product_id is not None:
        q = q.filter(DefectLog.product_id == product_id)
    rows = q.group_by("date").order_by("date").all()
    return [SummaryPoint(date=r.date, count=int(r.cnt)) for r in rows]


def by_defect(db: Session, days: int = 30, product_id: Optional[int] = None) -> list[ByDefectPoint]:
    cut = _cutoff(days)
    q = (
        db.query(
            DefectLog.defect_type_id,
            DefectType.label,
            DefectType.category_kind,
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.count().label("cnt"),
        )
        .join(DefectType, DefectLog.defect_type_id == DefectType.id)
        .join(Product, DefectLog.product_id == Product.id)
        .filter(DefectLog.logged_at >= cut)
    )
    if product_id is not None:
        q = q.filter(DefectLog.product_id == product_id)
    rows = (
        q.group_by(
            DefectLog.defect_type_id, DefectType.label,
            DefectType.category_kind, Product.id, Product.name,
        )
        .order_by(func.count().desc())
        .all()
    )
    return [
        ByDefectPoint(
            defect_type_id=r.defect_type_id,
            label=r.label,
            category_kind=r.category_kind,
            product_id=r.product_id,
            product_name=r.product_name,
            count=int(r.cnt),
        )
        for r in rows
    ]


def by_operator(db: Session, days: int = 30, product_id: Optional[int] = None) -> list[ByOperatorPoint]:
    cut = _cutoff(days)
    q = (
        db.query(
            DefectLog.operator_id,
            Operator.name,
            func.count().label("cnt"),
        )
        .join(Operator, DefectLog.operator_id == Operator.id)
        .filter(DefectLog.logged_at >= cut)
    )
    if product_id is not None:
        q = q.filter(DefectLog.product_id == product_id)
    rows = (
        q.group_by(DefectLog.operator_id, Operator.name)
        .order_by(func.count().desc())
        .all()
    )
    return [
        ByOperatorPoint(operator_id=r.operator_id, name=r.name, count=int(r.cnt))
        for r in rows
    ]


def heatmap(db: Session, days: int = 30, product_id: Optional[int] = None) -> list[HeatmapPoint]:
    cut = _cutoff(days)
    q = (
        db.query(
            func.strftime("%H", DefectLog.logged_at).label("hour_str"),
            func.count().label("cnt"),
        )
        .filter(DefectLog.logged_at >= cut)
    )
    if product_id is not None:
        q = q.filter(DefectLog.product_id == product_id)
    rows = q.group_by("hour_str").order_by("hour_str").all()
    return [HeatmapPoint(hour=int(r.hour_str), count=int(r.cnt)) for r in rows]
