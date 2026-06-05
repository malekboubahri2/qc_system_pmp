from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.product import Product
from app.models.defect import DefectType
from app.schemas.product import ProductCreate, ProductUpdate
from app.constants import CATEGORY_KIND_VALUES, OTHER_FALLBACK_LABEL


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _create_fallback_types(db: Session, product_id: int) -> None:
    for kind in CATEGORY_KIND_VALUES:
        db.add(DefectType(
            product_id=product_id,
            category_kind=kind,
            label=OTHER_FALLBACK_LABEL,
            is_other_fallback=True,
            display_order=999,
        ))


def get_all(db: Session, active_only: bool = True) -> list[Product]:
    q = db.query(Product)
    if active_only:
        q = q.filter(Product.active.is_(True))
    return q.order_by(Product.id).all()


def get_by_id(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return p


def create(db: Session, data: ProductCreate) -> Product:
    product = Product(
        name=data.name,
        reference=data.reference,
        client=data.client,
        cheatsheet=data.cheatsheet,
    )
    db.add(product)
    db.flush()  # get product.id without full commit
    _create_fallback_types(db, product.id)
    db.commit()
    db.refresh(product)
    return product


def update(db: Session, product_id: int, data: ProductUpdate) -> Product:
    p = get_by_id(db, product_id)
    fields = data.model_dump(exclude_unset=True)
    for field in ("name", "reference", "client", "cheatsheet"):
        if field in fields:
            setattr(p, field, fields[field])
    db.commit()
    db.refresh(p)
    return p


def archive(db: Session, product_id: int) -> None:
    p = get_by_id(db, product_id)
    p.active = False
    p.archived_at = _utc_now()
    db.commit()
