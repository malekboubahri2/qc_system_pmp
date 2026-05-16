import pytest
from app.models.defect import DefectCategory, DefectLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.security import hash_pin


@pytest.fixture
def seed(db):
    """Insert the minimum FK prerequisites and two defect logs."""
    cat = DefectCategory(name="Surface", display_order=0)
    db.add(cat)
    db.flush()

    dt = DefectType(category_id=cat.id, label="Scratch", display_order=0)
    db.add(dt)
    db.flush()

    op = Operator(name="Alice", pin_hash=hash_pin("1234"))
    db.add(op)
    db.flush()

    dev = Device(id="qc-stm32-aabbccdd")
    db.add(dev)
    db.flush()

    log1 = DefectLog(
        device_id=dev.id,
        operator_id=op.id,
        defect_type_id=dt.id,
        product_ref="REF-001",
        logged_at="2026-05-10T08:00:00Z",
    )
    log2 = DefectLog(
        device_id=dev.id,
        operator_id=op.id,
        defect_type_id=dt.id,
        product_ref="REF-002",
        logged_at="2026-05-11T09:30:00Z",
    )
    db.add_all([log1, log2])
    db.commit()
    return {"cat": cat, "dt": dt, "op": op, "dev": dev, "logs": [log1, log2]}


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
    assert item["defect_type"]["label"] == "Scratch"
    assert item["defect_type"]["category"] == "Surface"


def test_list_filter_by_operator(client, auth_headers, seed, db):
    # Add a second operator with a log
    op2 = Operator(name="Bob", pin_hash=hash_pin("5678"))
    db.add(op2)
    db.flush()
    s = seed
    db.add(DefectLog(
        device_id=s["dev"].id, operator_id=op2.id,
        defect_type_id=s["dt"].id, product_ref="REF-003",
        logged_at="2026-05-12T10:00:00Z",
    ))
    db.commit()

    resp = client.get(f"/logs?operator_id={op2.id}", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["operator"]["name"] == "Bob"


def test_list_filter_by_date_range(client, auth_headers, seed):
    resp = client.get(
        "/logs?from=2026-05-11T00:00:00Z&to=2026-05-11T23:59:59Z",
        headers=auth_headers,
    )
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["product_ref"] == "REF-002"


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
    assert client.get("/logs").status_code == 403
    assert client.get("/logs/export.csv").status_code == 403
