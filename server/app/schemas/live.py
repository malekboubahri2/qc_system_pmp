from typing import Optional
from pydantic import BaseModel


class LiveFeedEntry(BaseModel):
    """One recent defect on a station's feed. Timestamps stay UTC; the client
    renders the relative 'il y a …' label so it stays fresh between polls."""
    id: int
    label: str
    category: str            # display name, e.g. "PMP Défauts" / "Saisie libre"
    note: Optional[str] = None
    logged_at: str           # UTC ISO
    is_other: bool = False


class LiveStation(BaseModel):
    device_id: str
    name: Optional[str] = None             # device-reported friendly name
    online: bool
    last_seen: Optional[str] = None        # UTC ISO
    session_active: bool                   # recent inspection activity
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    session_started_at: Optional[str] = None  # UTC ISO of first part today
    # All counts are for the current plant-local day.
    defect_count: int = 0      # individual defects logged
    ok_count: int = 0          # parts that passed both categories
    today_count: int = 0       # distinct parts inspected
    last_hour_defects: int = 0
    feed: list[LiveFeedEntry] = []


class LiveStationsResponse(BaseModel):
    updated_at: str            # UTC ISO
    stations: list[LiveStation]
