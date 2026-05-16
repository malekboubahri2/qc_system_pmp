from pydantic import BaseModel


class SummaryPoint(BaseModel):
    date: str
    count: int


class ByDefectPoint(BaseModel):
    defect_type_id: int
    label: str
    category: str
    count: int


class ByOperatorPoint(BaseModel):
    operator_id: int
    name: str
    count: int


class HeatmapPoint(BaseModel):
    hour: int
    count: int
