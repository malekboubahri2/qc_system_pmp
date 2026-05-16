from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.defect import DefectCategory, DefectType
from app.schemas.defect import DefectCategoryCreate, DefectCategoryUpdate, DefectCategoryRead
from app.services import mqtt_payloads


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _count_stmt():
    return func.count(DefectType.id).filter(DefectType.active.is_(True))


def _to_read(cat: DefectCategory, defect_count: int) -> DefectCategoryRead:
    return DefectCategoryRead(
        id=cat.id,
        name=cat.name,
        display_order=cat.display_order,
        active=cat.active,
        created_at=cat.created_at,
        defect_count=defect_count,
    )


def _get_orm(db: Session, category_id: int) -> DefectCategory:
    cat = db.get(DefectCategory, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return cat


def get_all(db: Session, active_only: bool = True) -> list[DefectCategoryRead]:
    stmt = (
        select(DefectCategory, _count_stmt().label("defect_count"))
        .outerjoin(DefectType, DefectType.category_id == DefectCategory.id)
        .group_by(DefectCategory.id)
        .order_by(DefectCategory.display_order, DefectCategory.id)
    )
    if active_only:
        stmt = stmt.where(DefectCategory.active.is_(True))
    rows = db.execute(stmt).all()
    return [_to_read(cat, count) for cat, count in rows]


def get_by_id(db: Session, category_id: int) -> DefectCategoryRead:
    cat = _get_orm(db, category_id)
    count = (
        db.query(func.count(DefectType.id))
        .filter(DefectType.category_id == category_id, DefectType.active.is_(True))
        .scalar()
    ) or 0
    return _to_read(cat, count)


def create(db: Session, data: DefectCategoryCreate) -> DefectCategoryRead:
    cat = DefectCategory(name=data.name, display_order=data.display_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    mqtt_payloads.publish_defect_config()
    return _to_read(cat, 0)


def update(db: Session, category_id: int, data: DefectCategoryUpdate) -> DefectCategoryRead:
    cat = _get_orm(db, category_id)
    if data.name is not None:
        cat.name = data.name
    if data.display_order is not None:
        cat.display_order = data.display_order
    db.commit()
    db.refresh(cat)
    mqtt_payloads.publish_defect_config()
    return get_by_id(db, category_id)


def archive(db: Session, category_id: int) -> None:
    cat = _get_orm(db, category_id)
    cat.active = False
    cat.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_defect_config()
