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


def test_kpi_is_scoped_to_the_calling_operator(client, auth_headers, kpi_seed):
    s = kpi_seed

    def op_headers(name):
        created = client.post("/operators", json={"name": name}, headers=auth_headers).json()
        login = client.post(
            "/auth/login",
            json={"email": created["username"], "password": created["password"]},
        ).json()
        return {"Authorization": f"Bearer {login['access_token']}"}

    ha = op_headers("OpA")
    hb = op_headers("OpB")

    # A: 2 parts (1 NC). B: 1 part (OK). No operator_id in the body — derived.
    client.post("/inspections", headers=ha, json={"product_id": s["product"].id, "pmp_defect_type_ids": [s["pmp"].id], "inj_defect_type_ids": []})
    client.post("/inspections", headers=ha, json={"product_id": s["product"].id, "pmp_defect_type_ids": [], "inj_defect_type_ids": []})
    client.post("/inspections", headers=hb, json={"product_id": s["product"].id, "pmp_defect_type_ids": [], "inj_defect_type_ids": []})

    kpi_a = client.get("/kpi", headers=ha).json()
    assert kpi_a["inspected_parts"] == 2 and kpi_a["nc_parts"] == 1

    kpi_b = client.get("/kpi", headers=hb).json()
    assert kpi_b["inspected_parts"] == 1 and kpi_b["nc_parts"] == 0

    # Admin sees the global view (all 3 parts).
    kpi_admin = client.get("/kpi", headers=auth_headers).json()
    assert kpi_admin["inspected_parts"] == 3 and kpi_admin["nc_parts"] == 1


def test_kpi_since_scopes_to_the_session_window(client, auth_headers, kpi_seed):
    s = kpi_seed
    created = client.post("/operators", json={"name": "Sess"}, headers=auth_headers).json()
    login = client.post(
        "/auth/login",
        json={"email": created["username"], "password": created["password"]},
    ).json()
    h = {"Authorization": f"Bearer {login['access_token']}"}
    client.post("/inspections", headers=h, json={
        "product_id": s["product"].id, "pmp_defect_type_ids": [s["pmp"].id], "inj_defect_type_ids": [],
    })

    # since in the future → the part is before the session window
    assert client.get("/kpi?since=2999-01-01T00:00:00Z", headers=h).json()["inspected_parts"] == 0
    # since in the past → included
    assert client.get("/kpi?since=2000-01-01T00:00:00Z", headers=h).json()["inspected_parts"] == 1
