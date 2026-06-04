from typing import Optional
from pydantic import BaseModel, Field


class OperatorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class OperatorUpdate(BaseModel):
    name: Optional[str] = None


class OperatorRead(BaseModel):
    id: int
    name: str
    username: Optional[str] = None
    has_login: bool
    pin_set: bool
    active: bool
    created_at: str
    archived_at: Optional[str] = None

    model_config = {"from_attributes": True}


class OperatorWithCredentials(OperatorRead):
    """Returned ONCE on create / regenerate-password. `username` + `password`
    are the operator's login; only the password hash is stored (ADR-018)."""
    password: str
