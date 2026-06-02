import pytest
from app.models.defect import InspectionLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product
from app.security import hash_pin


@pytest.fixture
def seed(db):
    product = Product(name="Capot moteur")
    db.add(product)
    db.flush()

    pmp_dt = DefectType(
        product_id=product.id, category_kind="PMP",
        label="Poussière", is_other_fallback=False, display_order=0,
    )
    inj_dt = DefectType(
        product_id=product.id, category_kind="INJECTION",
        label="Givrage", is_other_fallback=False, display_order=0,
    )
    db.add_all([pmp_dt, inj_dt])
    db.flush()

    op = Operator(name="Alice", pin_hash=hash_pin("1234"))
    db.add(op)
    db.flush()

    dev = Device(id="qc-stm32-aabbccdd")
    db.add(dev)
    db.flush()

    common = dict(device_id=dev.id, operator_id=op.id, product_id=product.id)
    # Per-part model (ADR-016): each part expands to one row per category, with
    # an explicit category_kind and a shared part_inspection_id.
    logs = [
        # Part 1 @ 08:10Z — PMP defect, INJ ok
        InspectionLog(**common, defect_type_id=pmp_dt.id, outcome="DEFECT",
                      category_kind="PMP", part_inspection_id="p1", logged_at="2026-05-15T08:10:00Z"),
        InspectionLog(**common, defect_type_id=None, outcome="OK",
                      category_kind="INJECTION", part_inspection_id="p1", logged_at="2026-05-15T08:10:00Z"),
        # Part 2 @ 08:30Z — PMP ok, INJ defect
        InspectionLog(**common, defect_type_id=inj_dt.id, outcome="DEFECT",
                      category_kind="INJECTION", part_inspection_id="p2", logged_at="2026-05-15T08:30:00Z"),
        InspectionLog(**common, defect_type_id=None, outcome="OK",
                      category_kind="PMP", part_inspection_id="p2", logged_at="2026-05-15T08:30:00Z"),
    ]
    db.add_all(logs)
    db.commit()
    return {"product": product, "pmp_dt": pmp_dt, "inj_dt": inj_dt, "op": op, "dev": dev}


@pytest.fixture(autouse=True)
def _default_plant_tz(monkeypatch):
    """Pin the plant timezone to UTC so hourly buckets line up with the raw
    UTC hour in tests that don't exercise the timezone conversion itself."""
    from app.config import settings
    monkeypatch.setattr(settings, "plant_tz", "UTC")


def test_list_inspection_logs(client, auth_headers, seed):
    resp = client.get("/inspection-logs", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    outcomes = {item["outcome"] for item in body["items"]}
    assert outcomes == {"DEFECT", "OK"}


def test_list_ok_has_no_defect_type(client, auth_headers, seed):
    resp = client.get("/inspection-logs?outcome=OK", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 2
    for item in body["items"]:
        assert item["outcome"] == "OK"
        assert item["defect_type"] is None


def test_list_defect_has_defect_type(client, auth_headers, seed):
    resp = client.get("/inspection-logs?outcome=DEFECT", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 2
    for item in body["items"]:
        assert item["outcome"] == "DEFECT"
        assert item["defect_type"] is not None


def test_hourly_report_structure(client, auth_headers, seed):
    resp = client.get("/inspection-logs/reports/hourly?date=2026-05-15", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] == "2026-05-15"
    assert len(body["rows"]) == 24
    row_hours = [r["hour"] for r in body["rows"]]
    assert row_hours == list(range(24))


def test_hourly_report_counts_correct(client, auth_headers, seed):
    resp = client.get("/inspection-logs/reports/hourly?date=2026-05-15", headers=auth_headers)
    body = resp.json()
    # Both parts are at UTC hour 08 (plant_tz pinned to UTC by the fixture).
    hour8 = next(r for r in body["rows"] if r["hour"] == 8)
    # Taux NC counts *parts* per category: 2 parts inspected, 1 NC each.
    assert hour8["pmp_total"] == 2
    assert hour8["pmp_defects"] == 1
    assert hour8["inj_total"] == 2
    assert hour8["inj_defects"] == 1


def test_hourly_report_respects_plant_timezone(client, auth_headers, seed, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "plant_tz", "Africa/Tunis")  # UTC+1, no DST
    resp = client.get("/inspection-logs/reports/hourly?date=2026-05-15", headers=auth_headers)
    body = resp.json()
    # 08:10Z / 08:30Z fall in plant-local hour 09; hour 08 is empty.
    hour8 = next(r for r in body["rows"] if r["hour"] == 8)
    hour9 = next(r for r in body["rows"] if r["hour"] == 9)
    assert hour8["pmp_total"] == 0 and hour8["inj_total"] == 0
    assert hour9["pmp_total"] == 2 and hour9["pmp_defects"] == 1
    assert hour9["inj_total"] == 2 and hour9["inj_defects"] == 1


def test_hourly_report_empty_day(client, auth_headers):
    resp = client.get("/inspection-logs/reports/hourly?date=2000-01-01", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert all(r["pmp_total"] == 0 and r["inj_total"] == 0 for r in body["rows"])


def test_inspection_logs_requires_auth(client):
    assert client.get("/inspection-logs").status_code == 401
    assert client.get("/inspection-logs/reports/hourly").status_code == 401
