from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.defect import DefectCategory
from app.schemas.defect import DefectCategoryCreate, DefectCategoryUpdate
from app.services import mqtt_payloads


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_all(db: Session, active_only: bool = True) -> list[DefectCategory]:
    q = db.query(DefectCategory)
    if active_only:
        q = q.filter(DefectCategory.active.is_(True))
    return q.order_by(DefectCategory.display_order, DefectCategory.id).all()


def get_by_id(db: Session, category_id: int) -> DefectCategory:
    cat = db.get(DefectCategory, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return cat


def create(db: Session, data: DefectCategoryCreate) -> DefectCategory:
    cat = DefectCategory(name=data.name, display_order=data.display_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    mqtt_payloads.publish_defect_config(db)
    return cat


def update(db: Session, category_id: int, data: DefectCategoryUpdate) -> DefectCategory:
    cat = get_by_id(db, category_id)
    if data.name is not None:
        cat.name = data.name
    if data.display_order is not None:
        cat.display_order = data.display_order
    db.commit()
    db.refresh(cat)
    mqtt_payloads.publish_defect_config(db)
    return cat


def archive(db: Session, category_id: int) -> None:
    cat = get_by_id(db, category_id)
    cat.active = False
    cat.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_defect_config(db)
