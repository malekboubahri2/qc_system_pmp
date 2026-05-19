from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.defect import DefectTypeCreate, DefectTypeUpdate, DefectTypeRead
from app.services import defect_types as svc

router = APIRouter(
    prefix="/products/{product_id}/defect-types",
    tags=["defect-types"],
)


@router.get("", response_model=list[DefectTypeRead])
def list_types(
    product_id: int,
    category_kind: str | None = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, product_id, category_kind=category_kind, active_only=not include_archived)


@router.post("", response_model=DefectTypeRead, status_code=status.HTTP_201_CREATED)
def create_type(
    product_id: int,
    body: DefectTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.create(db, product_id, body)


@router.get("/{type_id}", response_model=DefectTypeRead)
def get_type(
    product_id: int,
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, product_id, type_id)


@router.patch("/{type_id}", response_model=DefectTypeRead)
def update_type(
    product_id: int,
    type_id: int,
    body: DefectTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.update(db, product_id, type_id, body)


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_type(
    product_id: int,
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, product_id, type_id)
