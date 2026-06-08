from typing import Optional
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    reference: Optional[str] = Field(default=None, max_length=64)
    client: Optional[str] = Field(default=None, max_length=120)
    cheatsheet: Optional[str] = Field(default=None, max_length=2000)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    reference: Optional[str] = Field(default=None, max_length=64)
    client: Optional[str] = Field(default=None, max_length=120)
    cheatsheet: Optional[str] = Field(default=None, max_length=2000)


class ProductRead(BaseModel):
    id: int
    name: str
    reference: Optional[str] = None
    client: Optional[str] = None
    cheatsheet: Optional[str] = None
    # Uploaded cheatsheet document: whether one is attached + its display name.
    # The bytes are fetched separately via GET /products/{id}/cheatsheet.
    has_cheatsheet_file: bool = False
    cheatsheet_name: Optional[str] = None
    active: bool
    created_at: str

    model_config = {"from_attributes": True}
