import pytest

from app.models.defect import DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.models.user import User
from app.security import hash_password, create_access_token


@pytest.fixture
def kpi_seed(db):
    product = Product(name="Capot moteur")
    db.add(product)
    db.flush()
    pmp = DefectType(product_id=product.id, category_kind="PMP",
                     label="Poussière", is_other_fallback=False, display_order=0)
    inj = DefectType(product_id=product.id, category_kind="INJECTION",
                     label="Givrage", is_other_fallback=False, display_order=0)
    op = Operator(name="Alice")
    db.add_all([pmp, inj, op])
    db.commit()
    for obj in (product, pmp, inj, op):
        db.refresh(obj)
    return {"product": product, "pmp": pmp, "inj": inj, "op": op}


def _headers_for(db, role: str) -> dict:
    user = User(email=f"{role}@test", password_hash=hash_password("x"), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _post_part(client, headers, seed, *, pmp=(), inj=()):
    resp = client.post("/inspections", headers=headers, json={
        "device_id": "qc-web-1",
        "operator_id": seed["op"].id,
        "product_id": seed["product"].id,
        "pmp_defect_type_ids": list(pmp),
        "inj_defect_type_ids": list(inj),
    })
    assert resp.status_code == 201
    return resp


def test_kpi_empty(client, db):
    resp = client.get("/kpi", headers=_headers_for(db, "station"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["inspected_parts"] == 0
    assert body["nc_parts"] == 0
    assert body["ok_parts"] == 0
    assert body["nc_rate"] == 0.0
    assert body["defect_count"] == 0


def test_kpi_counts_parts_and_nc_rate(client, db, kpi_seed):
    headers = _headers_for(db, "station")
    _post_part(client, headers, kpi_seed, pmp=[kpi_seed["pmp"].id])           # NC
    _post_part(client, headers, kpi_seed)                                     # OK part
    _post_part(client, headers, kpi_seed,
               pmp=[kpi_seed["pmp"].id], inj=[kpi_seed["inj"].id])            # NC, 2 defects

    body = client.get("/kpi", headers=headers).json()
    assert body["inspected_parts"] == 3
    assert body["nc_parts"] == 2
    assert body["ok_parts"] == 1
    assert body["defect_count"] == 3
    assert body["nc_rate"] == round(2 / 3, 4)
    assert body["last_hour_parts"] == 3


def test_kpi_other_day_is_empty(client, db, kpi_seed):
    headers = _headers_for(db, "station")
    _post_part(client, headers, kpi_seed, pmp=[kpi_seed["pmp"].id])
    body = client.get("/kpi?date=2020-01-01", headers=headers).json()
    assert body["date"] == "2020-01-01"
    assert body["inspected_parts"] == 0


def test_kpi_bad_date_returns_400(client, db):
    resp = client.get("/kpi?date=not-a-date", headers=_headers_for(db, "station"))
    assert resp.status_code == 400


def test_kpi_admin_allowed(client, auth_headers):
    assert client.get("/kpi", headers=auth_headers).status_code == 200


def test_kpi_requires_auth(client):
    assert client.get("/kpi").status_code == 401


def test_kpi_forbidden_for_other_role(client, db):
    resp = client.get("/kpi", headers=_headers_for(db, "viewer"))
    assert resp.status_code == 403
