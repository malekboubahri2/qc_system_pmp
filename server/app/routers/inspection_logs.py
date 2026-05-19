from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.log import HourlyReport, LogList
from app.services import inspection_logs as svc

router = APIRouter(prefix="/inspection-logs", tags=["inspection-logs"])


def _common(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    operator_id: Optional[int] = Query(None),
    defect_type_id: Optional[int] = Query(None),
    device_id: Optional[str] = Query(None),
    product_id: Optional[int] = Query(None),
    outcome: Optional[str] = Query(None, pattern="^(DEFECT|OK)$"),
):
    return dict(
        from_=from_,
        to=to,
        operator_id=operator_id,
        defect_type_id=defect_type_id,
        device_id=device_id,
        product_id=product_id,
        outcome=outcome,
    )


@router.get("", response_model=LogList)
def list_inspection_logs(
    filters: dict = Depends(_common),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_list(db, **filters, page=page, per_page=per_page)


@router.get("/export.csv")
def export_csv(
    filters: dict = Depends(_common),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    filename = f"inspection-logs-{date.today().isoformat()}.csv"
    return StreamingResponse(
        svc.iter_csv_rows(db, **filters),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/hourly", response_model=HourlyReport)
def hourly_report(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.compute_hourly_rates(db, report_date)
