from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.defect import DefectCategory, DefectType
from app.schemas.defect import DefectTypeCreate, DefectTypeUpdate
from app.services import mqtt_payloads

MAX_DEFECTS_PER_CATEGORY = 12


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_all(
    db: Session,
    category_id: int | None = None,
    active_only: bool = True,
) -> list[DefectType]:
    q = db.query(DefectType)
    if category_id is not None:
        q = q.filter(DefectType.category_id == category_id)
    if active_only:
        q = q.filter(DefectType.active.is_(True))
    return q.order_by(DefectType.display_order, DefectType.id).all()


def get_by_id(db: Session, type_id: int) -> DefectType:
    dt = db.get(DefectType, type_id)
    if dt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defect type not found")
    return dt


def _require_active_category(db: Session, category_id: int) -> None:
    cat = db.get(DefectCategory, category_id)
    if cat is None or not cat.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


def _check_cap(db: Session, category_id: int) -> None:
    count = (
        db.query(DefectType)
        .filter(DefectType.category_id == category_id, DefectType.active.is_(True))
        .count()
    )
    if count >= MAX_DEFECTS_PER_CATEGORY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category already has {MAX_DEFECTS_PER_CATEGORY} active defect types",
        )


def create(db: Session, data: DefectTypeCreate) -> DefectType:
    _require_active_category(db, data.category_id)
    _check_cap(db, data.category_id)
    dt = DefectType(
        category_id=data.category_id,
        label=data.label,
        display_order=data.display_order,
    )
    db.add(dt)
    db.commit()
    db.refresh(dt)
    mqtt_payloads.publish_defect_config()
    return dt


def update(db: Session, type_id: int, data: DefectTypeUpdate) -> DefectType:
    dt = get_by_id(db, type_id)
    if data.label is not None:
        dt.label = data.label
    if data.display_order is not None:
        dt.display_order = data.display_order
    db.commit()
    db.refresh(dt)
    mqtt_payloads.publish_defect_config()
    return dt


def archive(db: Session, type_id: int) -> None:
    dt = get_by_id(db, type_id)
    dt.active = False
    dt.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_defect_config()
