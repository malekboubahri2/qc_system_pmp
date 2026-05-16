from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.log import LogList
from app.services import defect_logs as svc

router = APIRouter(prefix="/logs", tags=["logs"])


def _common(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    operator_id: Optional[int] = Query(None),
    defect_type_id: Optional[int] = Query(None),
    device_id: Optional[str] = Query(None),
):
    return dict(
        from_=from_,
        to=to,
        operator_id=operator_id,
        defect_type_id=defect_type_id,
        device_id=device_id,
    )


@router.get("", response_model=LogList)
def list_logs(
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
    filename = f"defect-logs-{date.today().isoformat()}.csv"
    return StreamingResponse(
        svc.iter_csv_rows(db, **filters),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
