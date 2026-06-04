from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.models.user import User
from app.schemas.kpi import KpiSnapshot
from app.services import kpi as svc

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("", response_model=KpiSnapshot)
def get_kpi(
    date: Optional[str] = Query(None, description="Plant-local day YYYY-MM-DD; default today"),
    product_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("operator", "station", "admin")),
):
    """KPI snapshot for the andon board + dashboard hero tiles. Read-only,
    available to operators (PWA summary), the `station` token, and `admin`."""
    day = None
    if date is not None:
        try:
            day = date_cls.fromisoformat(date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date must be YYYY-MM-DD",
            )
    return svc.compute_kpi(db, day=day, product_id=product_id)
