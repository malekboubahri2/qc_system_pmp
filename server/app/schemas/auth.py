from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    email: str
    role: str
    # The linked operator for role `operator` (the PWA attributes inspections to
    # it); null for admins/stations. (ADR-018)
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}
