import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.feature_flag import FeatureFlagRead, FeatureFlagUpdate
from app.services import feature_flags as svc

router = APIRouter(prefix="/flags", tags=["feature-flags"])

_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


@router.get("", response_model=list[FeatureFlagRead])
def list_flags(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return svc.list_all(db)


@router.put("/{name}", response_model=FeatureFlagRead)
def upsert_flag(
    name: str,
    body: FeatureFlagUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not _NAME_RE.match(name):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="flag name must match ^[a-z][a-z0-9_]{0,63}$",
        )
    return svc.upsert(db, name, body.enabled, body.description)
