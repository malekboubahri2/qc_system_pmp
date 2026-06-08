from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from app.schemas.live_product import LiveProductsResponse
from app.services import products as svc
from app.services import live_products as live_svc

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
def list_products(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, active_only=not include_archived)


# Must precede /{product_id} so "live" isn't captured as a product id.
@router.get("/live", response_model=LiveProductsResponse)
def live_products(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return live_svc.compute_live_products(db)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.create(db, body)


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, product_id)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.update(db, product_id, body)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, product_id)


# ── Cheatsheet document (uploaded PDF/image) ────────────────────────────────

@router.post("/{product_id}/cheatsheet", response_model=ProductRead)
def upload_cheatsheet(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Attach/replace the product's cheatsheet document (admin only)."""
    data = file.file.read()  # sync read of the spooled upload (endpoint is sync)
    return svc.save_cheatsheet(db, product_id, data, file.content_type, file.filename)


@router.get("/{product_id}/cheatsheet")
def get_cheatsheet(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Serve the cheatsheet inline so the PWA/admin can embed it. Any signed-in
    user (incl. operators) may read it — it's reference material."""
    path, mime, name = svc.cheatsheet_for_serving(db, product_id)
    return FileResponse(path, media_type=mime, filename=name, content_disposition_type="inline")


@router.delete("/{product_id}/cheatsheet", status_code=status.HTTP_204_NO_CONTENT)
def delete_cheatsheet(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    svc.delete_cheatsheet(db, product_id)
