from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.models.user import User
from app.schemas.inspection import InspectionCreate, InspectionCreateResponse
from app.services.inspections import record_part

router = APIRouter(prefix="/inspections", tags=["inspections"])


@router.post("", response_model=InspectionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(
    body: InspectionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("station", "admin")),
):
    """Log one full part inspection from the web PWA. Same ingest path as MQTT."""
    part_id = record_part(
        db,
        device_id=body.device_id,
        operator_id=body.operator_id,
        product_id=body.product_id,
        pmp_defect_type_ids=body.pmp_defect_type_ids,
        inj_defect_type_ids=body.inj_defect_type_ids,
        note=body.note,
        logged_at=body.logged_at,
    )
    return InspectionCreateResponse(part_inspection_id=part_id)
