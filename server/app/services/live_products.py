"""Live-products view: real-time per-product activity for the dashboard.

Mirrors `live_stations` but pivots on the product instead of the device:
operators may inspect different products at the same time, so this groups
today's `inspection_logs` by product and surfaces, per product, the operators
currently working it, the part/NC counts, and a shared recent-defect feed.
All counts are for the current plant-local day.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.constants import CATEGORY_DISPLAY_NAMES
from app.models.defect import InspectionLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.schemas.live_product import (
    LiveProduct,
    LiveProductFeedEntry,
    LiveProductOperator,
    LiveProductsResponse,
)

_ISO = "%Y-%m-%dT%H:%M:%SZ"
_FEED_LIMIT = 10
# A product / operator counts as "active" if it logged something this recently.
_IDLE_SECONDS = 600
_OTHER_CATEGORY_LABEL = "Saisie libre"


def _iso(value: datetime) -> str:
    return value.strftime(_ISO)


def _rate(nc: int, total: int) -> float:
    return round(nc / total, 4) if total else 0.0


def compute_live_products(db: Session) -> LiveProductsResponse:
    tz = ZoneInfo(settings.plant_tz)
    now = datetime.now(timezone.utc)
    today_local = now.astimezone(tz).date()
    day_lo = _iso(datetime.combine(today_local, time.min, tzinfo=tz).astimezone(timezone.utc))
    hour_ago = _iso(now - timedelta(hours=1))
    active_cutoff = _iso(now - timedelta(seconds=_IDLE_SECONDS))

    # Today's rows, newest first, with the labels the view needs. outerjoin so
    # OK rows (no defect_type) still come through.
    rows = (
        db.query(
            InspectionLog,
            DefectType.label.label("defect_label"),
            DefectType.is_other_fallback.label("is_other"),
            Operator.name.label("operator_name"),
            Product.name.label("product_name"),
            Product.reference.label("product_reference"),
            Product.client.label("product_client"),
        )
        .outerjoin(DefectType, InspectionLog.defect_type_id == DefectType.id)
        .outerjoin(Operator, InspectionLog.operator_id == Operator.id)
        .outerjoin(Product, InspectionLog.product_id == Product.id)
        .filter(InspectionLog.logged_at >= day_lo)
        .filter(InspectionLog.product_id.isnot(None))
        .order_by(InspectionLog.logged_at.desc(), InspectionLog.id.desc())
        .all()
    )

    by_product: dict[int, list] = {}
    for row in rows:
        by_product.setdefault(row[0].product_id, []).append(row)

    products = [
        _build_product(prows, hour_ago, active_cutoff)
        for prows in by_product.values()
    ]
    # Stable multi-pass (least significant first): active products first, then
    # the busiest, then the most recently touched.
    products.sort(key=lambda p: p.last_activity or "", reverse=True)
    products.sort(key=lambda p: p.parts_today, reverse=True)
    products.sort(key=lambda p: p.active, reverse=True)
    return LiveProductsResponse(updated_at=_iso(now), products=products)


def _build_product(prows: list, hour_ago: str, active_cutoff: str) -> LiveProduct:
    """prows are one product's rows for today, newest first."""
    head = prows[0]
    product_id = head[0].product_id
    product_name = head.product_name or f"Produit #{product_id}"

    # Per-part state. A part shares one operator/product across its rows, so we
    # take operator from whichever row we see first (the newest).
    parts: dict[str, dict] = {}
    defect_count = 0
    last_hour_parts: set[str] = set()
    feed: list[LiveProductFeedEntry] = []

    for log, defect_label, is_other, operator_name, *_ in prows:
        pid = log.part_inspection_id or f"row{log.id}"
        part = parts.setdefault(pid, {
            "has_defect": False,
            "operator_id": log.operator_id,
            "operator_name": operator_name,
            "last_at": log.logged_at,
        })
        if log.logged_at >= hour_ago:
            last_hour_parts.add(pid)
        if log.outcome == "DEFECT":
            part["has_defect"] = True
            defect_count += 1
            if len(feed) < _FEED_LIMIT:
                category = (
                    _OTHER_CATEGORY_LABEL if is_other
                    else CATEGORY_DISPLAY_NAMES.get(log.category_kind, log.category_kind or "")
                )
                feed.append(LiveProductFeedEntry(
                    id=log.id,
                    label=defect_label or "Défaut",
                    category=category,
                    note=log.note,
                    operator_name=operator_name,
                    logged_at=log.logged_at,
                    is_other=bool(is_other),
                ))

    parts_today = len(parts)
    nc_parts = sum(1 for p in parts.values() if p["has_defect"])

    operators = _build_operators(parts, active_cutoff)
    last_activity = head[0].logged_at

    return LiveProduct(
        product_id=product_id,
        product_name=product_name,
        reference=head.product_reference,
        client=head.product_client,
        active=last_activity >= active_cutoff,
        last_activity=last_activity,
        parts_today=parts_today,
        nc_parts=nc_parts,
        ok_parts=parts_today - nc_parts,
        defect_count=defect_count,
        nc_rate=_rate(nc_parts, parts_today),
        last_hour_parts=len(last_hour_parts),
        active_operators=sum(1 for o in operators if o.active),
        operators=operators,
        feed=feed,
    )


def _build_operators(parts: dict, active_cutoff: str) -> list[LiveProductOperator]:
    """Fold per-part state into per-operator totals on this product."""
    agg: dict = {}
    for part in parts.values():
        oid = part["operator_id"]
        row = agg.setdefault(oid, {
            "name": part["operator_name"],
            "parts": 0,
            "nc": 0,
            "last_at": part["last_at"],
        })
        row["parts"] += 1
        if part["has_defect"]:
            row["nc"] += 1
        if part["last_at"] > row["last_at"]:
            row["last_at"] = part["last_at"]

    operators = [
        LiveProductOperator(
            operator_id=oid,
            operator_name=row["name"],
            parts=row["parts"],
            nc_parts=row["nc"],
            nc_rate=_rate(row["nc"], row["parts"]),
            last_at=row["last_at"],
            active=row["last_at"] >= active_cutoff,
        )
        for oid, row in agg.items()
    ]
    # Most productive first; active operators win ties via their recency.
    operators.sort(key=lambda o: (o.parts, o.last_at or ""), reverse=True)
    return operators
