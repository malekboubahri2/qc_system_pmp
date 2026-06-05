from typing import Optional
from pydantic import BaseModel


class ReportDefectRow(BaseModel):
    label: str
    count: int


class ReportOperatorRow(BaseModel):
    operator: str
    matricule: Optional[str] = None
    rank: int = 0          # 1-based, by parts inspected (productivity score)
    parts: int             # the productivity score
    nc_parts: int
    nc_rate: float


class ReportProductRow(BaseModel):
    product: str
    reference: Optional[str] = None
    parts: int
    nc_parts: int
    nc_rate: float
    pmp_nc_parts: int
    inj_nc_parts: int


class ReportDailyRow(BaseModel):
    date: str          # plant-local YYYY-MM-DD
    parts: int
    nc_parts: int
    nc_rate: float


class QualityReport(BaseModel):
    """Aggregated quality metrics for a plant-local date range, ready to render
    and print from the dashboard. Everything is per part (one full inspection)."""
    date_from: str
    date_to: str
    generated_at: str
    inspected_parts: int
    nc_parts: int
    ok_parts: int
    nc_rate: float
    pmp_nc_parts: int
    pmp_nc_rate: float
    inj_nc_parts: int
    inj_nc_rate: float
    defects_total: int
    top_defects: list[ReportDefectRow]
    by_operator: list[ReportOperatorRow]
    by_product: list[ReportProductRow]
    daily: list[ReportDailyRow]
