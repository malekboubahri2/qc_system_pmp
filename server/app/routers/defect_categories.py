from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.defect import DefectCategoryCreate, DefectCategoryUpdate, DefectCategoryRead
from app.services import defect_categories as svc

router = APIRouter(prefix="/defect-categories", tags=["defect-categories"])


@router.get("", response_model=list[DefectCategoryRead])
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return svc.get_all(db)


@router.post("", response_model=DefectCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    body: DefectCategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.create(db, body)


@router.get("/{category_id}", response_model=DefectCategoryRead)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, category_id)


@router.patch("/{category_id}", response_model=DefectCategoryRead)
def update_category(
    category_id: int,
    body: DefectCategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.update(db, category_id, body)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, category_id)
