from typing import Optional
from pydantic import BaseModel, Field


class DefectCategoryCreate(BaseModel):
    name: str
    display_order: int = 0


class DefectCategoryUpdate(BaseModel):
    name: Optional[str] = None
    display_order: Optional[int] = None


class DefectCategoryRead(BaseModel):
    id: int
    name: str
    display_order: int
    active: bool
    created_at: str
    defect_count: int = 0

    model_config = {"from_attributes": True}


class DefectTypeCreate(BaseModel):
    category_id: int
    label: str = Field(max_length=24)
    display_order: int = 0


class DefectTypeUpdate(BaseModel):
    label: Optional[str] = Field(default=None, max_length=24)
    display_order: Optional[int] = None


class DefectTypeRead(BaseModel):
    id: int
    category_id: int
    label: str
    display_order: int
    active: bool
    created_at: str

    model_config = {"from_attributes": True}
