# Retained for import compatibility — all logic moved to inspection_logs.py
from app.services.inspection_logs import (  # noqa: F401
    get_list,
    iter_csv_rows,
    compute_hourly_rates,
)
