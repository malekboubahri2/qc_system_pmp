from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.operator import OperatorCreate, OperatorUpdate, OperatorSetPin, OperatorRead
from app.services import operators as svc

router = APIRouter(prefix="/operators", tags=["operators"])


@router.get("", response_model=list[OperatorRead])
def list_operators(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return svc.get_all(db)


@router.post("", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
def create_operator(
    body: OperatorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.create(db, body)


@router.get("/{operator_id}", response_model=OperatorRead)
def get_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, operator_id)


@router.patch("/{operator_id}", response_model=OperatorRead)
def update_operator(
    operator_id: int,
    body: OperatorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.update(db, operator_id, body)


@router.put("/{operator_id}/pin", response_model=OperatorRead)
def set_pin(
    operator_id: int,
    body: OperatorSetPin,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.set_pin(db, operator_id, body.pin)


@router.delete("/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, operator_id)
