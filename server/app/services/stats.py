from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.defect import DefectCategory, DefectLog, DefectType
from app.models.operator import Operator
from app.schemas.stats import ByDefectPoint, ByOperatorPoint, HeatmapPoint, SummaryPoint


def _cutoff(days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def summary(db: Session, days: int = 7) -> list[SummaryPoint]:
    cut = _cutoff(days)
    rows = (
        db.query(
            func.strftime("%Y-%m-%d", DefectLog.logged_at).label("date"),
            func.count().label("cnt"),
        )
        .filter(DefectLog.logged_at >= cut)
        .group_by("date")
        .order_by("date")
        .all()
    )
    return [SummaryPoint(date=r.date, count=int(r.cnt)) for r in rows]


def by_defect(db: Session, days: int = 30) -> list[ByDefectPoint]:
    cut = _cutoff(days)
    rows = (
        db.query(
            DefectLog.defect_type_id,
            DefectType.label,
            DefectCategory.name.label("category"),
            func.count().label("cnt"),
        )
        .join(DefectType, DefectLog.defect_type_id == DefectType.id)
        .join(DefectCategory, DefectType.category_id == DefectCategory.id)
        .filter(DefectLog.logged_at >= cut)
        .group_by(DefectLog.defect_type_id, DefectType.label, DefectCategory.name)
        .order_by(func.count().desc())
        .all()
    )
    return [
        ByDefectPoint(
            defect_type_id=r.defect_type_id,
            label=r.label,
            category=r.category,
            count=int(r.cnt),
        )
        for r in rows
    ]


def by_operator(db: Session, days: int = 30) -> list[ByOperatorPoint]:
    cut = _cutoff(days)
    rows = (
        db.query(
            DefectLog.operator_id,
            Operator.name,
            func.count().label("cnt"),
        )
        .join(Operator, DefectLog.operator_id == Operator.id)
        .filter(DefectLog.logged_at >= cut)
        .group_by(DefectLog.operator_id, Operator.name)
        .order_by(func.count().desc())
        .all()
    )
    return [
        ByOperatorPoint(operator_id=r.operator_id, name=r.name, count=int(r.cnt))
        for r in rows
    ]


def heatmap(db: Session, days: int = 30) -> list[HeatmapPoint]:
    cut = _cutoff(days)
    rows = (
        db.query(
            func.strftime("%H", DefectLog.logged_at).label("hour_str"),
            func.count().label("cnt"),
        )
        .filter(DefectLog.logged_at >= cut)
        .group_by("hour_str")
        .order_by("hour_str")
        .all()
    )
    return [HeatmapPoint(hour=int(r.hour_str), count=int(r.cnt)) for r in rows]
