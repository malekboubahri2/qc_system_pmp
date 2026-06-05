from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.models.user import User
from app.schemas.report import QualityReport
from app.services import reports as svc

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse(d: Optional[str], default: date_cls) -> date_cls:
    if d is None:
        return default
    try:
        return date_cls.fromisoformat(d)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from/to must be YYYY-MM-DD",
        )


@router.get("/quality", response_model=QualityReport)
def quality_report(
    date_from: Optional[str] = Query(None, alias="from", description="Plant-local YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, alias="to", description="Plant-local YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Aggregated quality metrics for a date range, for the printable dashboard
    report. Defaults to the last 30 plant-local days."""
    today = datetime.now(timezone.utc).date()
    to = _parse(date_to, today)
    frm = _parse(date_from, to - timedelta(days=29))
    if frm > to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from must be on or before to",
        )
    return svc.build_report(db, frm, to)
