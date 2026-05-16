from pydantic import BaseModel


class _OperatorRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class _DefectTypeRef(BaseModel):
    id: int
    label: str
    category: str

    model_config = {"from_attributes": True}


class LogRead(BaseModel):
    id: int
    device_id: str
    operator: _OperatorRef
    defect_type: _DefectTypeRef
    product_ref: str
    logged_at: str
    received_at: str

    model_config = {"from_attributes": True}


class LogList(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[LogRead]
