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


@pytest.fixture
def live_seed(db):
    product = Product(name="Capot moteur")
    db.add(product)
    db.flush()
    pmp = DefectType(
        product_id=product.id, category_kind="PMP",
        label="Poussière", is_other_fallback=False, display_order=0,
    )
    db.add(pmp)
    db.flush()
    op = Operator(name="Alice")
    db.add(op)
    db.flush()

    online = Device(id="qc-stm32-online", last_seen=_iso(-5))
    archived = Device(id="qc-stm32-archived", last_seen=_iso(-5), active=False, archived_at=_iso(-10))
    db.add_all([online, archived])
    db.flush()

    now = _iso()
    db.add_all([
        InspectionLog(device_id=online.id, operator_id=op.id, product_id=product.id,
                      defect_type_id=pmp.id, outcome="DEFECT", category_kind="PMP",
                      part_inspection_id="p1", logged_at=now),
        InspectionLog(device_id=online.id, operator_id=op.id, product_id=product.id,
                      defect_type_id=None, outcome="OK", category_kind="INJECTION",
                      part_inspection_id="p1", logged_at=now),
    ])
    db.commit()
    return {"online": online, "archived": archived, "op": op, "product": product}


def test_live_excludes_archived_and_infers_session(client, auth_headers, live_seed):
    resp = client.get("/devices/live", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()

    # Archived devices never appear; only the active one does.
    assert [s["device_id"] for s in body["stations"]] == ["qc-stm32-online"]

    s = body["stations"][0]
    assert s["online"] is True
    assert s["session_active"] is True            # activity within the idle window
    assert s["operator_name"] == "Alice"          # inferred from the latest row
    assert s["product_name"] == "Capot moteur"
    assert s["today_count"] == 1                   # one part inspected
    assert s["defect_count"] == 1                  # one PMP defect row
    assert s["ok_count"] == 0                      # the part has a defect → not fully OK
    assert len(s["feed"]) == 1
    assert s["feed"][0]["label"] == "Poussière"
    assert s["feed"][0]["category"] == "PMP Défauts"


def test_live_requires_auth(client):
    assert client.get("/devices/live").status_code == 401
