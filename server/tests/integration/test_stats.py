import pytest
from app.models.defect import DefectCategory, DefectLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.security import hash_pin


@pytest.fixture
def seed(db):
    cat = DefectCategory(name="Paint", display_order=0)
    db.add(cat)
    db.flush()

    dt1 = DefectType(category_id=cat.id, label="Run", display_order=0)
    dt2 = DefectType(category_id=cat.id, label="Sag", display_order=1)
    db.add_all([dt1, dt2])
    db.flush()

    op1 = Operator(name="Ali", pin_hash=hash_pin("1111"))
    op2 = Operator(name="Sara", pin_hash=hash_pin("2222"))
    db.add_all([op1, op2])
    db.flush()

    dev = Device(id="qc-stm32-11223344")
    db.add(dev)
    db.flush()

    logs = [
        DefectLog(device_id=dev.id, operator_id=op1.id, defect_type_id=dt1.id,
                  product_ref="R1", logged_at="2026-05-14T08:15:00Z"),
        DefectLog(device_id=dev.id, operator_id=op1.id, defect_type_id=dt1.id,
                  product_ref="R2", logged_at="2026-05-14T09:00:00Z"),
        DefectLog(device_id=dev.id, operator_id=op2.id, defect_type_id=dt2.id,
                  product_ref="R3", logged_at="2026-05-15T14:30:00Z"),
    ]
    db.add_all(logs)
    db.commit()


def test_summary_empty(client, auth_headers):
    resp = client.get("/stats/summary?days=7", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_summary_groups_by_date(client, auth_headers, seed):
    resp = client.get("/stats/summary?days=365", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    dates = {p["date"]: p["count"] for p in body}
    assert dates.get("2026-05-14") == 2
    assert dates.get("2026-05-15") == 1


def test_by_defect_ordered_by_count(client, auth_headers, seed):
    resp = client.get("/stats/by-defect?days=365", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["label"] == "Run"
    assert body[0]["count"] == 2
    assert body[1]["label"] == "Sag"
    assert body[1]["count"] == 1
    assert body[0]["category"] == "Paint"


def test_by_operator_ordered_by_count(client, auth_headers, seed):
    resp = client.get("/stats/by-operator?days=365", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["name"] == "Ali"
    assert body[0]["count"] == 2
    assert body[1]["name"] == "Sara"
    assert body[1]["count"] == 1


def test_heatmap_groups_by_hour(client, auth_headers, seed):
    resp = client.get("/stats/heatmap?days=365", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    by_hour = {p["hour"]: p["count"] for p in body}
    assert by_hour.get(8) == 1
    assert by_hour.get(9) == 1
    assert by_hour.get(14) == 1


def test_days_validation(client, auth_headers):
    assert client.get("/stats/summary?days=0", headers=auth_headers).status_code == 422
    assert client.get("/stats/summary?days=366", headers=auth_headers).status_code == 422


def test_requires_auth(client):
    for path in ["/stats/summary", "/stats/by-defect", "/stats/by-operator", "/stats/heatmap"]:
        assert client.get(path).status_code == 403
