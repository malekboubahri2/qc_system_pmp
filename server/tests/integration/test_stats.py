import pytest
from app.models.defect import DefectLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product
from app.security import hash_pin


@pytest.fixture
def seed(db):
    product = Product(name="Capot")
    db.add(product)
    db.flush()

    dt1 = DefectType(
        product_id=product.id, category_kind="PMP",
        label="Run", is_other_fallback=False, display_order=0,
    )
    dt2 = DefectType(
        product_id=product.id, category_kind="INJECTION",
        label="Sag", is_other_fallback=False, display_order=1,
    )
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
        DefectLog(
            device_id=dev.id, operator_id=op1.id, defect_type_id=dt1.id,
            product_id=product.id, logged_at="2026-05-14T08:15:00Z",
        ),
        DefectLog(
            device_id=dev.id, operator_id=op1.id, defect_type_id=dt1.id,
            product_id=product.id, logged_at="2026-05-14T09:00:00Z",
        ),
        DefectLog(
            device_id=dev.id, operator_id=op2.id, defect_type_id=dt2.id,
            product_id=product.id, logged_at="2026-05-15T14:30:00Z",
        ),
    ]
    db.add_all(logs)
    db.commit()
    return {"product": product}


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
    assert body[0]["category_kind"] == "PMP"
    assert body[0]["product_name"] == "Capot"
    assert body[1]["label"] == "Sag"
    assert body[1]["count"] == 1
    assert body[1]["category_kind"] == "INJECTION"


def test_by_defect_filter_by_product(client, auth_headers, seed, db):
    p2 = Product(name="Autre")
    db.add(p2)
    db.flush()
    dt = DefectType(
        product_id=p2.id, category_kind="PMP",
        label="Casse", is_other_fallback=False, display_order=0,
    )
    db.add(dt)
    db.flush()
    dev = Device(id="qc-stm32-other")
    op = Operator(name="Test", pin_hash=hash_pin("9999"))
    db.add_all([dev, op])
    db.flush()
    db.add(DefectLog(
        device_id=dev.id, operator_id=op.id,
        defect_type_id=dt.id, product_id=p2.id,
        logged_at="2026-05-15T10:00:00Z",
    ))
    db.commit()
    pid = seed["product"].id
    resp = client.get(f"/stats/by-defect?days=365&product_id={pid}", headers=auth_headers)
    body = resp.json()
    assert all(r["product_id"] == pid for r in body)


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
        assert client.get(path).status_code == 401
