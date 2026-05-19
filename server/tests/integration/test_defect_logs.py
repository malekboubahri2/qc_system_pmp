import pytest
from app.models.defect import InspectionLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product
from app.security import hash_pin


@pytest.fixture
def seed(db):
    """Insert minimum FK prerequisites and two inspection logs (both DEFECT)."""
    product = Product(name="Capot moteur")
    db.add(product)
    db.flush()

    dt = DefectType(
        product_id=product.id,
        category_kind="PMP",
        label="Rayure",
        is_other_fallback=False,
        display_order=0,
    )
    db.add(dt)
    db.flush()

    op = Operator(name="Alice", pin_hash=hash_pin("1234"))
    db.add(op)
    db.flush()

    dev = Device(id="qc-stm32-aabbccdd")
    db.add(dev)
    db.flush()

    log1 = InspectionLog(
        device_id=dev.id,
        operator_id=op.id,
        defect_type_id=dt.id,
        product_id=product.id,
        outcome="DEFECT",
        logged_at="2026-05-10T08:00:00Z",
    )
    log2 = InspectionLog(
        device_id=dev.id,
        operator_id=op.id,
        defect_type_id=dt.id,
        product_id=product.id,
        outcome="DEFECT",
        note="préciser: bord droit",
        logged_at="2026-05-11T09:30:00Z",
    )
    db.add_all([log1, log2])
    db.commit()
    return {"product": product, "dt": dt, "op": op, "dev": dev, "logs": [log1, log2]}


def test_list_empty(client, auth_headers):
    resp = client.get("/logs", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_returns_logs(client, auth_headers, seed):
    resp = client.get("/logs", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    item = body["items"][0]
    assert item["operator"]["name"] == "Alice"
    assert item["defect_type"]["label"] == "Rayure"
    assert item["defect_type"]["category_kind"] == "PMP"
    assert item["product"]["name"] == "Capot moteur"
    assert item["outcome"] == "DEFECT"


def test_list_returns_note(client, auth_headers, seed):
    resp = client.get("/logs?from=2026-05-11T00:00:00Z", headers=auth_headers)
    item = resp.json()["items"][0]
    assert item["note"] == "préciser: bord droit"


def test_list_filter_by_operator(client, auth_headers, seed, db):
    op2 = Operator(name="Bob", pin_hash=hash_pin("5678"))
    db.add(op2)
    db.flush()
    s = seed
    db.add(InspectionLog(
        device_id=s["dev"].id, operator_id=op2.id,
        defect_type_id=s["dt"].id, product_id=s["product"].id,
        outcome="DEFECT",
        logged_at="2026-05-12T10:00:00Z",
    ))
    db.commit()

    resp = client.get(f"/logs?operator_id={op2.id}", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["operator"]["name"] == "Bob"


def test_list_filter_by_product(client, auth_headers, seed, db):
    p2 = Product(name="Autre produit")
    db.add(p2)
    db.flush()
    dt2 = DefectType(
        product_id=p2.id, category_kind="INJECTION",
        label="Casse", is_other_fallback=False, display_order=0,
    )
    db.add(dt2)
    db.flush()
    s = seed
    db.add(InspectionLog(
        device_id=s["dev"].id, operator_id=s["op"].id,
        defect_type_id=dt2.id, product_id=p2.id,
        outcome="DEFECT",
        logged_at="2026-05-12T10:00:00Z",
    ))
    db.commit()

    resp = client.get(f"/logs?product_id={p2.id}", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["product"]["name"] == "Autre produit"


def test_list_filter_by_date_range(client, auth_headers, seed):
    resp = client.get(
        "/logs?from=2026-05-11T00:00:00Z&to=2026-05-11T23:59:59Z",
        headers=auth_headers,
    )
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["note"] == "préciser: bord droit"


def test_list_pagination(client, auth_headers, seed):
    resp = client.get("/logs?page=1&per_page=1", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 1
    assert body["per_page"] == 1


def test_export_csv(client, auth_headers, seed):
    resp = client.get("/logs/export.csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "defect-logs-" in resp.headers["content-disposition"]
    lines = resp.text.strip().splitlines()
    assert lines[0].startswith("id,device_id")
    assert len(lines) == 3  # header + 2 rows


def test_requires_auth(client):
    assert client.get("/logs").status_code == 401
    assert client.get("/logs/export.csv").status_code == 401
