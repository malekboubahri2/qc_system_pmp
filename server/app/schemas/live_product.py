from typing import Optional
from pydantic import BaseModel


class LiveProductFeedEntry(BaseModel):
    """One recent defect logged on a product, across all operators inspecting it.
    Timestamps stay UTC; the client renders the relative 'il y a …' label."""
    id: int
    label: str
    category: str            # display name, e.g. "PMP Défauts" / "Saisie libre"
    note: Optional[str] = None
    operator_name: Optional[str] = None
    logged_at: str           # UTC ISO
    is_other: bool = False


class LiveProductOperator(BaseModel):
    """An operator's contribution to one product today."""
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    parts: int = 0           # distinct parts this operator inspected on the product
    nc_parts: int = 0        # of those, how many had at least one defect
    nc_rate: float = 0.0
    last_at: Optional[str] = None   # UTC ISO of their latest part
    active: bool = False     # logged within the idle window


class LiveProduct(BaseModel):
    product_id: int
    product_name: str
    reference: Optional[str] = None
    client: Optional[str] = None
    active: bool                       # recent inspection activity on the product
    last_activity: Optional[str] = None  # UTC ISO of the newest part today
    # All counts are for the current plant-local day.
    parts_today: int = 0       # distinct parts inspected
    nc_parts: int = 0          # parts with at least one defect
    ok_parts: int = 0          # parts that passed both categories
    defect_count: int = 0      # individual defects logged
    nc_rate: float = 0.0
    last_hour_parts: int = 0
    active_operators: int = 0
    operators: list[LiveProductOperator] = []
    feed: list[LiveProductFeedEntry] = []


class LiveProductsResponse(BaseModel):
    updated_at: str            # UTC ISO
    products: list[LiveProduct]
