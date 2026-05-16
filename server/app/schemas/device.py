from typing import Optional
from pydantic import BaseModel


class DeviceRead(BaseModel):
    id: str
    last_seen: Optional[str] = None
    config_version: Optional[int] = None
    operator_version: Optional[int] = None
    active: bool
    first_seen: str

    model_config = {"from_attributes": True}
