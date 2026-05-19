from typing import Optional
from pydantic import BaseModel, Field
from app.constants import CATEGORY_KIND_VALUES


class DefectTypeCreate(BaseModel):
    category_kind: str = Field(pattern=f"^({'|'.join(CATEGORY_KIND_VALUES)})$")
    label: str = Field(min_length=1, max_length=24)
    display_order: int = 0


class DefectTypeUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=24)
    display_order: Optional[int] = None


class DefectTypeRead(BaseModel):
    id: int
    product_id: int
    category_kind: str
    label: str
    is_other_fallback: bool
    display_order: int
    active: bool
    created_at: str

    model_config = {"from_attributes": True}
