from pydantic import BaseModel


class ReportDefectRow(BaseModel):
    label: str
    count: int


class ReportOperatorRow(BaseModel):
    operator: str
    parts: int
    nc_parts: int
    nc_rate: float


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
    daily: list[ReportDailyRow]
