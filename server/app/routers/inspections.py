from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.models.user import User
from app.schemas.inspection import InspectionCreate, InspectionCreateResponse
from app.services.inspections import record_part
from app.services import operators as operators_svc

router = APIRouter(prefix="/inspections", tags=["inspections"])


@router.post("", response_model=InspectionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(
    body: InspectionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("operator", "station", "admin")),
):
    """Log one full part inspection from the web PWA. Same ingest path as MQTT.

    An `operator` is attributed to their own linked operator — the body cannot
    spoof it. Admin/station callers must supply `operator_id` (e.g. for tooling).
    """
    if user.role == "operator":
        operator_id = operators_svc.operator_id_for_user(db, user.id)
        if operator_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No operator profile linked to this account",
            )
    else:
        if body.operator_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="operator_id is required for non-operator callers",
            )
        operator_id = body.operator_id

    part_id = record_part(
        db,
        device_id=body.device_id,
        operator_id=operator_id,
        product_id=body.product_id,
        pmp_defect_type_ids=body.pmp_defect_type_ids,
        inj_defect_type_ids=body.inj_defect_type_ids,
        note=body.note,
        logged_at=body.logged_at,
    )
    return InspectionCreateResponse(part_inspection_id=part_id)
