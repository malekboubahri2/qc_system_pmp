from typing import Optional
from pydantic import BaseModel


class FeatureFlagRead(BaseModel):
    name: str
    enabled: bool
    description: Optional[str] = None
    updated_at: str

    model_config = {"from_attributes": True}


class FeatureFlagUpdate(BaseModel):
    enabled: bool
    description: Optional[str] = None
