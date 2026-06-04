from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.models.operator import Operator
from app.schemas.operator import (
    OperatorCreate, OperatorUpdate, OperatorSetPin, OperatorVerifyPin,
    OperatorRead, OperatorWithPin,
)
from app.services import operators as svc

router = APIRouter(prefix="/operators", tags=["operators"])


def _with_pin(op: Operator, pin: str) -> OperatorWithPin:
    return OperatorWithPin(**OperatorRead.model_validate(op).model_dump(), pin=pin)


# Declared before /{operator_id} so "verify-pin" is not parsed as an id.
@router.post("/verify-pin", status_code=status.HTTP_204_NO_CONTENT)
def verify_operator_pin(
    body: OperatorVerifyPin,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("station", "admin")),
):
    """Verify an operator's PIN (PWA login step). 204 on match, 401 otherwise."""
    if not svc.verify_pin(db, body.operator_id, body.pin):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN")


@router.get("", response_model=list[OperatorRead])
def list_operators(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_all(db, active_only=not include_archived)


@router.post("", response_model=OperatorWithPin, status_code=status.HTTP_201_CREATED)
def create_operator(
    body: OperatorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create an operator. The server mints a unique PIN and returns it in
    plaintext exactly once — relay it to the operator, it cannot be retrieved
    again (only regenerated)."""
    op, pin = svc.create(db, body)
    return _with_pin(op, pin)


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


@router.post("/{operator_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
def set_pin(
    operator_id: int,
    body: OperatorSetPin,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.set_pin(db, operator_id, body.pin)


@router.post("/{operator_id}/regenerate-pin", response_model=OperatorWithPin)
def regenerate_pin(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Rotate the operator's PIN and return the new value once (reveal once)."""
    op, pin = svc.regenerate_pin(db, operator_id)
    return _with_pin(op, pin)


@router.delete("/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.archive(db, operator_id)
