from typing import Literal, Optional
from pydantic import BaseModel, Field

SCHEMA_VERSION_STATUS = 1
SCHEMA_VERSION_DEFECT = 2        # legacy — reject with warning
SCHEMA_VERSION_INSPECTION = 3    # current
SCHEMA_VERSION_CMD = 1
SCHEMA_VERSION_CONFIG = 2
SCHEMA_VERSION_OPERATORS = 1
SCHEMA_VERSION_SESSION = 1


class StatusPayload(BaseModel):
    schema_version: int
    device_id: str
    uptime_ms: int
    config_version: int
    operator_version: int
    queue_depth: int
    wifi_rssi: int
    mqtt_reconnects: int


class InspectionPayload(BaseModel):
    schema_version: int
    device_id: str
    operator_id: int
    product_id: int
    outcome: Literal["DEFECT", "OK"]
    # Required for DEFECT, absent for OK; validated in handler
    defect_type_id: Optional[int] = None
    note: Optional[str] = Field(default=None, max_length=140)
    logged_at: str


# Legacy schema kept for version-check rejection only
class DefectPayload(BaseModel):
    schema_version: int
    device_id: str
    operator_id: int
    defect_type_id: int
    product_id: int
    note: Optional[str] = Field(default=None, max_length=140)
    logged_at: str


class SessionPayload(BaseModel):
    schema_version: int
    device_id: str
    operator_id: int
    product_id: int
    started_at: str


class CmdPayload(BaseModel):
    schema_version: int = SCHEMA_VERSION_CMD
    cmd: Literal["reboot", "reload_config", "reload_operators", "set_log_level"]
    params: dict = Field(default_factory=dict)
