from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.models.user import User
from app.schemas.kpi import KpiSnapshot
from app.schemas.kpi_board import KpiBoardResponse
from app.services import kpi as svc
from app.services import kpi_board as board_svc
from app.services import operators as operators_svc

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/board", response_model=KpiBoardResponse)
def get_kpi_board(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("station", "admin")),
):
    """Bounded snapshot for the andon wall board (ADR-020): global block + top
    products + trending defects. Threshold-agnostic; the firmware colours it."""
    return board_svc.compute_board(db)


@router.get("", response_model=KpiSnapshot)
def get_kpi(
    date: Optional[str] = Query(None, description="Plant-local day YYYY-MM-DD; default today"),
    product_id: Optional[int] = Query(None),
    operator_id: Optional[int] = Query(None, description="Admin/station only; operators are scoped to themselves"),
    since: Optional[str] = Query(None, description="UTC ISO lower bound — the PWA passes its login time for a session-scoped Taux NC"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("operator", "station", "admin")),
):
    """KPI snapshot for the andon board, dashboard, and the PWA summary.

    An `operator` caller is always scoped to *their own* parts; with `since` set
    to their login time the PWA shows the operator's **session** Taux NC rather
    than the whole day. Admin / station callers see the global view, optionally
    filtered by `operator_id`.
    """
    day = None
    if date is not None:
        try:
            day = date_cls.fromisoformat(date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date must be YYYY-MM-DD",
            )

    if user.role == "operator":
        scoped_operator_id = operators_svc.operator_id_for_user(db, user.id)
    else:
        scoped_operator_id = operator_id

    return svc.compute_kpi(
        db, day=day, product_id=product_id,
        operator_id=scoped_operator_id, since=since,
    )
