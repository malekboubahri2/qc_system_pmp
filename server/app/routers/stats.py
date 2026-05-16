from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.stats import ByDefectPoint, ByOperatorPoint, HeatmapPoint, SummaryPoint
from app.services import stats as svc

router = APIRouter(prefix="/stats", tags=["stats"])

_days_q = Query(7, ge=1, le=365)


@router.get("/summary", response_model=list[SummaryPoint])
def get_summary(
    days: int = _days_q,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.summary(db, days)


@router.get("/by-defect", response_model=list[ByDefectPoint])
def get_by_defect(
    days: int = _days_q,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.by_defect(db, days)


@router.get("/by-operator", response_model=list[ByOperatorPoint])
def get_by_operator(
    days: int = _days_q,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.by_operator(db, days)


@router.get("/heatmap", response_model=list[HeatmapPoint])
def get_heatmap(
    days: int = _days_q,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.heatmap(db, days)
