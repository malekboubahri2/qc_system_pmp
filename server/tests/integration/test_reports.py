import pytest

from app.models.defect import DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.models.user import User
from app.security import hash_password, create_access_token


@pytest.fixture
def seed(db):
    product = Product(name="Capot")
    db.add(product)
    db.flush()
    pmp = DefectType(product_id=product.id, category_kind="PMP", label="Poussière", display_order=0)
    inj = DefectType(product_id=product.id, category_kind="INJECTION", label="Givrage", display_order=0)
    op = Operator(name="Alice")
    db.add_all([pmp, inj, op])
    db.commit()
    for o in (product, pmp, inj, op):
        db.refresh(o)
    return {"product": product, "pmp": pmp, "inj": inj, "op": op}


def _headers(db, role):
    u = User(email=f"{role}@t", password_hash=hash_password("x"), role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def _post(client, h, s, *, pmp=(), inj=()):
    client.post("/inspections", headers=h, json={
        "operator_id": s["op"].id, "product_id": s["product"].id,
        "pmp_defect_type_ids": list(pmp), "inj_defect_type_ids": list(inj),
    })


def test_quality_report_aggregates_per_part(client, db, auth_headers, seed):
    s = seed
    _post(client, auth_headers, s, pmp=[s["pmp"].id])   # PMP NC
    _post(client, auth_headers, s, inj=[s["inj"].id])   # INJ NC
    _post(client, auth_headers, s)                       # OK

    r = client.get("/reports/quality", headers=auth_headers).json()
    assert r["inspected_parts"] == 3
    assert r["nc_parts"] == 2
    assert r["ok_parts"] == 1
    assert r["pmp_nc_parts"] == 1
    assert r["inj_nc_parts"] == 1
    assert r["defects_total"] == 2
    labels = {d["label"] for d in r["top_defects"]}
    assert {"Poussière", "Givrage"} <= labels
    by_op = {o["operator"]: o for o in r["by_operator"]}
    assert by_op["Alice"]["parts"] == 3 and by_op["Alice"]["nc_parts"] == 2


def test_quality_report_requires_admin(client, db, seed):
    assert client.get("/reports/quality", headers=_headers(db, "operator")).status_code == 403


def test_quality_report_bad_date(client, auth_headers):
    assert client.get("/reports/quality?from=notadate", headers=auth_headers).status_code == 400


def test_quality_report_requires_auth(client):
    assert client.get("/reports/quality").status_code == 401
