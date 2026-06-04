from typing import Optional
from pydantic import BaseModel, Field


class OperatorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class OperatorUpdate(BaseModel):
    name: Optional[str] = None


class OperatorSetPin(BaseModel):
    pin: str = Field(min_length=4, max_length=8, pattern=r"^\d+$")


class OperatorVerifyPin(BaseModel):
    operator_id: int
    pin: str = Field(min_length=1, max_length=12)


class OperatorRead(BaseModel):
    id: int
    name: str
    pin_set: bool
    active: bool
    created_at: str
    archived_at: Optional[str] = None

    model_config = {"from_attributes": True}
