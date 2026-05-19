from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.product import Product
from app.models.defect import DefectType
from app.schemas.defect import DefectTypeCreate, DefectTypeUpdate
from app.services import mqtt_payloads
from app.constants import DEFECT_TYPES_PER_CATEGORY_CAP


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _require_active_product(db: Session, product_id: int) -> None:
    p = db.get(Product, product_id)
    if p is None or not p.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


def _check_cap(db: Session, product_id: int, category_kind: str) -> None:
    count = (
        db.query(DefectType)
        .filter(
            DefectType.product_id == product_id,
            DefectType.category_kind == category_kind,
            DefectType.active.is_(True),
            DefectType.is_other_fallback.is_(False),
        )
        .count()
    )
    if count >= DEFECT_TYPES_PER_CATEGORY_CAP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Category {category_kind} already has "
                f"{DEFECT_TYPES_PER_CATEGORY_CAP} active defect types"
            ),
        )


def get_all(
    db: Session,
    product_id: int,
    category_kind: str | None = None,
    active_only: bool = True,
) -> list[DefectType]:
    q = db.query(DefectType).filter(DefectType.product_id == product_id)
    if category_kind is not None:
        q = q.filter(DefectType.category_kind == category_kind)
    if active_only:
        q = q.filter(DefectType.active.is_(True))
    return q.order_by(DefectType.is_other_fallback, DefectType.display_order, DefectType.id).all()


def get_by_id(db: Session, product_id: int, type_id: int) -> DefectType:
    dt = db.query(DefectType).filter(
        DefectType.id == type_id,
        DefectType.product_id == product_id,
    ).first()
    if dt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defect type not found")
    return dt


def create(db: Session, product_id: int, data: DefectTypeCreate) -> DefectType:
    _require_active_product(db, product_id)
    _check_cap(db, product_id, data.category_kind)
    dt = DefectType(
        product_id=product_id,
        category_kind=data.category_kind,
        label=data.label,
        is_other_fallback=False,
        display_order=data.display_order,
    )
    db.add(dt)
    db.commit()
    db.refresh(dt)
    mqtt_payloads.publish_products_config()
    return dt


def update(db: Session, product_id: int, type_id: int, data: DefectTypeUpdate) -> DefectType:
    dt = get_by_id(db, product_id, type_id)
    if data.label is not None:
        dt.label = data.label
    if data.display_order is not None:
        dt.display_order = data.display_order
    db.commit()
    db.refresh(dt)
    mqtt_payloads.publish_products_config()
    return dt


def archive(db: Session, product_id: int, type_id: int) -> None:
    dt = get_by_id(db, product_id, type_id)
    if dt.is_other_fallback:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The fallback defect type cannot be archived",
        )
    dt.active = False
    dt.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_products_config()
