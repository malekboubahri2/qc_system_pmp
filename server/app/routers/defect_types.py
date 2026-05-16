from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.defect import DefectTypeCreate, DefectTypeUpdate, DefectTypeRead
from app.services import defect_types as svc

router = APIRouter(prefix="/defect-types", tags=["defect-types"])


@router.get("", response_model=list[DefectTypeRead])
def list_types(
    category_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, category_id=category_id)


@router.post("", response_model=DefectTypeRead, status_code=status.HTTP_201_CREATED)
def create_type(
    body: DefectTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.create(db, body)


@router.get("/{type_id}", response_model=DefectTypeRead)
def get_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, type_id)


@router.patch("/{type_id}", response_model=DefectTypeRead)
def update_type(
    type_id: int,
    body: DefectTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.update(db, type_id, body)


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_type(
    type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, type_id)
