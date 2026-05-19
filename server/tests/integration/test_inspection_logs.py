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
    logs = [
        InspectionLog(**common, defect_type_id=pmp_dt.id, outcome="DEFECT", logged_at="2026-05-15T08:10:00Z"),
        InspectionLog(**common, defect_type_id=None, outcome="OK", logged_at="2026-05-15T08:20:00Z"),
        InspectionLog(**common, defect_type_id=inj_dt.id, outcome="DEFECT", logged_at="2026-05-15T08:30:00Z"),
        InspectionLog(**common, defect_type_id=None, outcome="OK", logged_at="2026-05-15T08:40:00Z"),
    ]
    db.add_all(logs)
    db.commit()
    return {"product": product, "pmp_dt": pmp_dt, "inj_dt": inj_dt, "op": op, "dev": dev}


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
    # All 4 logs are at hour 08
    hour8 = next(r for r in body["rows"] if r["hour"] == 8)
    # PMP: 1 DEFECT + 2 OK (OK logs counted for both categories)
    assert hour8["pmp_defects"] == 1
    assert hour8["pmp_total"] == 3
    assert hour8["inj_defects"] == 1
    assert hour8["inj_total"] == 3


def test_hourly_report_empty_day(client, auth_headers):
    resp = client.get("/inspection-logs/reports/hourly?date=2000-01-01", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert all(r["pmp_total"] == 0 and r["inj_total"] == 0 for r in body["rows"])


def test_inspection_logs_requires_auth(client):
    assert client.get("/inspection-logs").status_code == 401
    assert client.get("/inspection-logs/reports/hourly").status_code == 401
