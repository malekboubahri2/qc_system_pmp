from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services import auth as auth_svc
from app.services import operators as operators_svc

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    token = auth_svc.authenticate(db, body.email, body.password)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    operator_id = (
        operators_svc.operator_id_for_user(db, current_user.id)
        if current_user.role == "operator"
        else None
    )
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        operator_id=operator_id,
    )
