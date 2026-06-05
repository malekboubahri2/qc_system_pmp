from datetime import datetime, timedelta, timezone

import pytest

from app.models.defect import InspectionLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product


def _iso(offset_s: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=offset_s)).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture(autouse=True)
def _utc_plant_tz(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "plant_tz", "UTC")


def _pmp(db, product):
    dt = DefectType(product_id=product.id, category_kind="PMP",
                    label="Poussière", is_other_fallback=False, display_order=0)
    db.add(dt)
    db.flush()
    return dt


def _part(db, *, product, op, pid, defect_type=None, at=None):
    """A part = one PMP row (DEFECT if a defect_type is given, else OK) + one
    INJECTION OK row, sharing a part_inspection_id."""
    when = at or _iso()
    db.add(InspectionLog(
        device_id="qc-web-1", operator_id=op.id, product_id=product.id,
        defect_type_id=defect_type.id if defect_type else None,
        outcome="DEFECT" if defect_type else "OK", category_kind="PMP",
        part_inspection_id=pid, logged_at=when,
    ))
    db.add(InspectionLog(
        device_id="qc-web-1", operator_id=op.id, product_id=product.id,
        defect_type_id=None, outcome="OK", category_kind="INJECTION",
        part_inspection_id=pid, logged_at=when,
    ))


@pytest.fixture
def live_seed(db):
    p1 = Product(name="Capot moteur", reference="CM-100", client="Renault")
    p2 = Product(name="Pare-chocs")
    idle = Product(name="Sans activité")  # no inspections today → must not appear
    db.add_all([p1, p2, idle])
    db.flush()
    d1, d2 = _pmp(db, p1), _pmp(db, p2)
    alice, bob = Operator(name="Alice"), Operator(name="Bob")
    db.add(Device(id="qc-web-1", last_seen=_iso(-5)))
    db.add_all([alice, bob])
    db.flush()

    # P1: Alice 2 parts (1 NC), Bob 1 part (OK) → 3 parts, 1 NC.
    _part(db, product=p1, op=alice, pid="p1a", defect_type=d1)
    _part(db, product=p1, op=alice, pid="p1b")
    _part(db, product=p1, op=bob, pid="p1c")
    # P2: Alice 1 part (NC) → 1 part, 1 NC.
    _part(db, product=p2, op=alice, pid="p2a", defect_type=d2)
    db.commit()
    return {"p1": p1, "p2": p2, "idle": idle, "alice": alice, "bob": bob}


def _by_id(body, pid):
    return next(p for p in body["products"] if p["product_id"] == pid)


def test_live_products_only_shows_active_products(client, auth_headers, live_seed):
    body = client.get("/products/live", headers=auth_headers).json()
    ids = [p["product_id"] for p in body["products"]]
    assert live_seed["idle"].id not in ids
    # Busiest product first (P1 has 3 parts, P2 has 1).
    assert ids == [live_seed["p1"].id, live_seed["p2"].id]


def test_live_products_part_and_nc_counts(client, auth_headers, live_seed):
    body = client.get("/products/live", headers=auth_headers).json()
    p1 = _by_id(body, live_seed["p1"].id)
    assert p1["parts_today"] == 3
    assert p1["nc_parts"] == 1
    assert p1["ok_parts"] == 2
    assert p1["defect_count"] == 1
    assert p1["nc_rate"] == round(1 / 3, 4)
    assert p1["reference"] == "CM-100"
    assert p1["client"] == "Renault"
    assert p1["active"] is True

    p2 = _by_id(body, live_seed["p2"].id)
    assert p2["parts_today"] == 1 and p2["nc_parts"] == 1 and p2["nc_rate"] == 1.0


def test_live_products_operator_breakdown(client, auth_headers, live_seed):
    body = client.get("/products/live", headers=auth_headers).json()
    p1 = _by_id(body, live_seed["p1"].id)
    ops = {o["operator_name"]: o for o in p1["operators"]}
    assert ops["Alice"]["parts"] == 2 and ops["Alice"]["nc_parts"] == 1
    assert ops["Bob"]["parts"] == 1 and ops["Bob"]["nc_parts"] == 0
    # Most productive operator first.
    assert p1["operators"][0]["operator_name"] == "Alice"
    assert p1["active_operators"] == 2


def test_live_products_feed_carries_operator(client, auth_headers, live_seed):
    body = client.get("/products/live", headers=auth_headers).json()
    p1 = _by_id(body, live_seed["p1"].id)
    assert len(p1["feed"]) == 1
    entry = p1["feed"][0]
    assert entry["label"] == "Poussière"
    assert entry["operator_name"] == "Alice"
    assert entry["category"]  # display name, non-empty


def test_live_products_idle_product_is_inactive(client, auth_headers, db, live_seed):
    # A part logged 20 min ago → product still listed but not "active".
    old = _iso(-1200)
    _part(db, product=live_seed["p2"], op=live_seed["bob"], pid="p2old", at=old)
    # Push P2's only recent row back too so the whole product is stale.
    db.query(InspectionLog).filter(InspectionLog.part_inspection_id == "p2a").update(
        {InspectionLog.logged_at: old}
    )
    db.commit()
    body = client.get("/products/live", headers=auth_headers).json()
    p2 = _by_id(body, live_seed["p2"].id)
    assert p2["active"] is False
    assert p2["active_operators"] == 0


def test_live_products_requires_auth(client):
    assert client.get("/products/live").status_code == 401
