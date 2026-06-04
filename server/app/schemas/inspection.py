from typing import Optional
from pydantic import BaseModel, Field


class InspectionCreate(BaseModel):
    """One full part inspection submitted by the web PWA (schema 4, ADR-016/017).

    An empty list for a category means the part passed (OK) for it. `device_id`
    identifies the station/tablet (defaults to a shared web id). `logged_at` is
    the client wall-clock (UTC ISO); omit to let the server stamp receipt time.
    """
    device_id: str = Field(default="qc-web", min_length=1, max_length=64)
    operator_id: int
    product_id: int
    pmp_defect_type_ids: list[int] = Field(default_factory=list)
    inj_defect_type_ids: list[int] = Field(default_factory=list)
    note: Optional[str] = Field(default=None, max_length=140)
    logged_at: Optional[str] = None


class InspectionCreateResponse(BaseModel):
    part_inspection_id: str
