from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from app.services import products as svc

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
def list_products(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, active_only=not include_archived)


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
