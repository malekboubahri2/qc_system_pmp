from typing import Optional
from pydantic import BaseModel, Field


class DeviceRead(BaseModel):
    id: str
    name: Optional[str] = None
    last_seen: Optional[str] = None
    online: bool
    config_version: Optional[int] = None
    operator_version: Optional[int] = None
    active: bool
    first_seen: str

    model_config = {"from_attributes": True}


class DeviceHeartbeat(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, max_length=64)


class DeviceDisconnect(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
