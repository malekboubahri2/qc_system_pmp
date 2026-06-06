import pytest

from app.models.defect import DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.models.user import User
from app.security import hash_password, create_access_token


@pytest.fixture(autouse=True)
def _utc_plant_tz(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "plant_tz", "UTC")


def _headers_for(db, role: str) -> dict:
    user = User(email=f"{role}@test", password_hash=hash_password("x"), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _pmp(db, product, label):
    dt = DefectType(product_id=product.id, category_kind="PMP",
                    label=label, is_other_fallback=False, display_order=0)
    db.add(dt)
    db.flush()
    return dt


@pytest.fixture
def board_seed(db):
    capot = Product(name="Capot")
    pare = Product(name="Pare-chocs")
    db.add_all([capot, pare])
    db.flush()
    pouss = _pmp(db, capot, "Poussière")
    givr = _pmp(db, pare, "Givrage")
    op = Operator(name="Alice")
    db.add(op)
    db.commit()
    for o in (capot, pare, pouss, givr, op):
        db.refresh(o)
    return {"capot": capot, "pare": pare, "pouss": pouss, "givr": givr, "op": op}


def _post(client, headers, op, product, *, pmp=()):
    resp = client.post("/inspections", headers=headers, json={
        "device_id": "qc-web-1",
        "operator_id": op.id,
        "product_id": product.id,
        "pmp_defect_type_ids": list(pmp),
        "inj_defect_type_ids": [],
    })
    assert resp.status_code == 201


def test_board_empty(client, db):
    body = client.get("/kpi/board", headers=_headers_for(db, "station")).json()
    assert body["inspected_parts"] == 0
    assert body["products"] == []
    assert body["defects"] == []


def test_board_global_products_and_defects(client, db, board_seed):
    s = board_seed
    h = _headers_for(db, "station")
    _post(client, h, s["op"], s["capot"], pmp=[s["pouss"].id])   # NC, Poussière
    _post(client, h, s["op"], s["capot"], pmp=[s["pouss"].id])   # NC, Poussière
    _post(client, h, s["op"], s["capot"])                        # OK
    _post(client, h, s["op"], s["pare"], pmp=[s["givr"].id])     # NC, Givrage

    body = client.get("/kpi/board", headers=h).json()
    assert body["inspected_parts"] == 4
    assert body["nc_parts"] == 3
    assert body["ok_parts"] == 1
    assert body["nc_rate"] == round(3 / 4, 4)

    # Products: busiest first (Capot 3 parts, then Pare-chocs 1).
    assert [p["name"] for p in body["products"]] == ["Capot", "Pare-chocs"]
    assert body["products"][0]["parts"] == 3
    assert body["products"][0]["nc_rate"] == round(2 / 3, 4)
    assert body["products"][1]["nc_rate"] == 1.0

    # Defects: by count desc, ratio = share of all defects today.
    assert [d["label"] for d in body["defects"]] == ["Poussière", "Givrage"]
    assert body["defects"][0]["count"] == 2
    assert body["defects"][0]["ratio"] == round(2 / 3, 4)
    assert body["defects"][1]["ratio"] == round(1 / 3, 4)


def test_board_caps_to_four(client, db):
    h = _headers_for(db, "station")
    op = Operator(name="Bob")
    db.add(op)
    db.flush()
    # 5 products, each with one NC part → 5 active products / 5 distinct defects.
    for i in range(5):
        p = Product(name=f"P{i}")
        db.add(p)
        db.flush()
        dt = _pmp(db, p, f"Défaut{i}")
        db.commit()
        _post(client, h, op, p, pmp=[dt.id])

    body = client.get("/kpi/board", headers=h).json()
    assert len(body["products"]) == 4
    assert len(body["defects"]) == 4


def test_board_admin_allowed(client, auth_headers):
    assert client.get("/kpi/board", headers=auth_headers).status_code == 200


def test_board_forbidden_for_operator(client, db):
    assert client.get("/kpi/board", headers=_headers_for(db, "operator")).status_code == 403


def test_board_requires_auth(client):
    assert client.get("/kpi/board").status_code == 401
