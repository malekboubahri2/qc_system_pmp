from typing import Optional
from pydantic import BaseModel, Field

# Matricule doubles as the login username (ADR-018), so keep it login-safe.
_MATRICULE = r"^[A-Za-z0-9._-]+$"


class OperatorCreate(BaseModel):
    matricule: str = Field(min_length=1, max_length=32, pattern=_MATRICULE)
    name: str = Field(min_length=1, max_length=64)
    last_name: Optional[str] = Field(default=None, max_length=64)
    phone: Optional[str] = Field(default=None, max_length=32)
    address: Optional[str] = Field(default=None, max_length=255)


class OperatorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    last_name: Optional[str] = Field(default=None, max_length=64)
    phone: Optional[str] = Field(default=None, max_length=32)
    address: Optional[str] = Field(default=None, max_length=255)


class OperatorRead(BaseModel):
    id: int
    matricule: Optional[str] = None
    name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    username: Optional[str] = None
    has_login: bool
    pin_set: bool
    active: bool
    created_at: str
    archived_at: Optional[str] = None

    model_config = {"from_attributes": True}


class OperatorWithCredentials(OperatorRead):
    """Returned ONCE on create / regenerate-password. `username` (= matricule) +
    `password` are the operator's login; only the password hash is stored."""
    password: str
