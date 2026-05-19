from typing import Literal, Optional
from pydantic import BaseModel


class _OperatorRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class _DefectTypeRef(BaseModel):
    id: int
    label: str
    category_kind: str

    model_config = {"from_attributes": True}


class _ProductRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class LogRead(BaseModel):
    id: int
    device_id: str
    operator: _OperatorRef
    defect_type: Optional[_DefectTypeRef]
    product: _ProductRef
    outcome: Literal["DEFECT", "OK"]
    note: Optional[str]
    logged_at: str
    received_at: str

    model_config = {"from_attributes": True}


class LogList(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[LogRead]


class HourlyRow(BaseModel):
    hour: int  # 0-23 UTC
    pmp_total: int
    pmp_defects: int
    pmp_rate: float  # 0.0-1.0
    inj_total: int
    inj_defects: int
    inj_rate: float


class HourlyReport(BaseModel):
    date: str  # ISO date YYYY-MM-DD (UTC)
    rows: list[HourlyRow]  # always 24 entries
