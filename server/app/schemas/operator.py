from typing import Optional
from pydantic import BaseModel, Field


class OperatorCreate(BaseModel):
    name: str
    pin: str = Field(min_length=4, max_length=8, pattern=r"^\d+$")


class OperatorUpdate(BaseModel):
    name: Optional[str] = None


class OperatorSetPin(BaseModel):
    pin: str = Field(min_length=4, max_length=8, pattern=r"^\d+$")


class OperatorRead(BaseModel):
    id: int
    name: str
    active: bool
    created_at: str

    model_config = {"from_attributes": True}
