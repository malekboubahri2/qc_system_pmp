from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.operator import Operator
from app.schemas.operator import (
    OperatorCreate, OperatorUpdate, OperatorRead, OperatorWithCredentials,
)
from app.services import operators as svc

router = APIRouter(prefix="/operators", tags=["operators"])


def _with_creds(op: Operator, username: str, password: str) -> OperatorWithCredentials:
    base = OperatorRead.model_validate(op).model_dump()
    base["username"] = username
    return OperatorWithCredentials(**base, password=password)


@router.get("", response_model=list[OperatorRead])
def list_operators(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, active_only=not include_archived)


@router.post("", response_model=OperatorWithCredentials, status_code=status.HTTP_201_CREATED)
def create_operator(
    body: OperatorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create an operator and its login account. The username + password are
    returned in plaintext exactly once — relay them to the operator."""
    op, username, password = svc.create(db, body)
    return _with_creds(op, username, password)


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


@router.post("/{operator_id}/regenerate-password", response_model=OperatorWithCredentials)
def regenerate_password(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Rotate the operator's login password and return it once (reveal once)."""
    op, username, password = svc.regenerate_password(db, operator_id)
    return _with_creds(op, username, password)


@router.delete("/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, operator_id)
