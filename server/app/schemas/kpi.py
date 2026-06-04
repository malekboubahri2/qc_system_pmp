from pydantic import BaseModel, Field


class KpiSnapshot(BaseModel):
    """Single-day quality snapshot for the andon board + dashboard hero tiles.

    `taux NC` = nc_parts / inspected_parts. All counts are per-part (a part is
    one full inspection, grouped by `part_inspection_id`), not per defect row.
    """

    date: str = Field(description="Plant-local day, YYYY-MM-DD")
    inspected_parts: int = Field(description="Distinct parts inspected that day")
    nc_parts: int = Field(description="Parts with at least one defect")
    ok_parts: int = Field(description="Parts with no defect")
    nc_rate: float = Field(description="nc_parts / inspected_parts, 0.0–1.0")
    defect_count: int = Field(description="Total defect rows (a part may have several)")
    last_hour_parts: int = Field(description="Distinct parts inspected in the last 60 min")
    updated_at: str = Field(description="When this snapshot was computed (UTC)")
