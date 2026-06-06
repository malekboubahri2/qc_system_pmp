from pydantic import BaseModel


class KpiBoardProduct(BaseModel):
    """One product on the andon board. Threshold-agnostic — the firmware maps
    nc_rate to a severity colour using its own configured thresholds."""
    name: str
    parts: int
    nc_rate: float


class KpiBoardDefect(BaseModel):
    """One trending defect; `ratio` is its share of all defects today."""
    label: str
    count: int
    ratio: float


class KpiBoardResponse(BaseModel):
    """Bounded snapshot for the KPI andon board (ADR-020). One fixed-shape
    payload the firmware parses into fixed buffers: a global block plus the top
    products and defects (server pre-sorted and truncated)."""
    updated_at: str            # UTC ISO
    date: str                  # plant-local YYYY-MM-DD
    nc_rate: float
    inspected_parts: int
    nc_parts: int
    ok_parts: int
    products: list[KpiBoardProduct]   # <= MAX_PRODUCTS, busiest/active first
    defects: list[KpiBoardDefect]     # <= MAX_DEFECTS, by count desc
