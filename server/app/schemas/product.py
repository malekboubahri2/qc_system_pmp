from typing import Optional
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)


class ProductRead(BaseModel):
    id: int
    name: str
    active: bool
    created_at: str

    model_config = {"from_attributes": True}
