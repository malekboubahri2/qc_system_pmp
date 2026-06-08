import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.models.product import Product
from app.models.defect import DefectType
from app.schemas.product import ProductCreate, ProductUpdate
from app.constants import CATEGORY_KIND_VALUES, OTHER_FALLBACK_LABEL

# Accepted cheatsheet document types -> file extension.
_CHEATSHEET_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


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


# ── Cheatsheet document (uploaded PDF/image) ────────────────────────────────

def _upload_dir() -> Path:
    d = Path(settings.upload_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _remove_cheatsheet_file(stored: Optional[str]) -> None:
    if stored:
        try:
            (Path(settings.upload_dir) / stored).unlink(missing_ok=True)
        except OSError:
            pass  # best-effort; a leftover file is harmless, a 500 is not


def save_cheatsheet(
    db: Session, product_id: int, data: bytes, content_type: Optional[str], filename: Optional[str]
) -> Product:
    """Validate and store an uploaded cheatsheet document, replacing any previous
    one. Raises 415 (bad type), 400 (empty), 413 (too large)."""
    p = get_by_id(db, product_id)
    mime = (content_type or "").split(";")[0].strip().lower()
    ext = _CHEATSHEET_TYPES.get(mime)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type — PDF, PNG, JPEG or WebP only",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > settings.cheatsheet_max_bytes:
        raise HTTPException(
            status_code=413,  # Content Too Large
            detail=f"File too large (max {settings.cheatsheet_max_bytes // (1024 * 1024)} MiB)",
        )

    _remove_cheatsheet_file(p.cheatsheet_file)
    stored = f"product_{product_id}_{uuid.uuid4().hex}{ext}"
    (_upload_dir() / stored).write_bytes(data)

    p.cheatsheet_file = stored
    p.cheatsheet_mime = mime
    p.cheatsheet_name = (filename or f"cheatsheet{ext}")[:200]
    db.commit()
    db.refresh(p)
    return p


def delete_cheatsheet(db: Session, product_id: int) -> None:
    p = get_by_id(db, product_id)
    _remove_cheatsheet_file(p.cheatsheet_file)
    p.cheatsheet_file = None
    p.cheatsheet_mime = None
    p.cheatsheet_name = None
    db.commit()


def cheatsheet_for_serving(db: Session, product_id: int) -> tuple[Path, str, str]:
    """Return (path, mime, download_name) for the product's cheatsheet, or 404."""
    p = get_by_id(db, product_id)
    if not p.cheatsheet_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No cheatsheet for this product")
    path = Path(settings.upload_dir) / p.cheatsheet_file
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cheatsheet file missing")
    return path, p.cheatsheet_mime or "application/octet-stream", p.cheatsheet_name or p.cheatsheet_file
