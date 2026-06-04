import pytest

from app.models.defect import InspectionLog, DefectType
from app.models.operator import Operator
from app.models.product import Product
from app.models.user import User
from app.security import hash_password, create_access_token


@pytest.fixture
def insp_seed(db):
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
    db.refresh(pmp)
    db.refresh(inj)
    db.refresh(op)
    db.refresh(product)
    return {"product": product, "pmp": pmp, "inj": inj, "op": op}


def _headers_for(db, role: str) -> dict:
    user = User(email=f"{role}@test", password_hash=hash_password("x"), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_post_inspection_creates_rows(client, db, insp_seed):
    s = insp_seed
    resp = client.post("/inspections", headers=_headers_for(db, "station"), json={
        "device_id": "qc-web-1",
        "operator_id": s["op"].id,
        "product_id": s["product"].id,
        "pmp_defect_type_ids": [s["pmp"].id],
        "inj_defect_type_ids": [],
    })
    assert resp.status_code == 201
    part_id = resp.json()["part_inspection_id"]
    db.expire_all()
    rows = db.query(InspectionLog).filter(InspectionLog.part_inspection_id == part_id).all()
    assert len(rows) == 2  # one PMP DEFECT + one INJECTION OK
    assert {(r.category_kind, r.outcome) for r in rows} == {("PMP", "DEFECT"), ("INJECTION", "OK")}


def test_post_inspection_admin_allowed(client, auth_headers, insp_seed):
    s = insp_seed
    resp = client.post("/inspections", headers=auth_headers, json={
        "operator_id": s["op"].id,
        "product_id": s["product"].id,
        "inj_defect_type_ids": [s["inj"].id],
    })
    assert resp.status_code == 201


def test_post_inspection_requires_auth(client):
    resp = client.post("/inspections", json={"operator_id": 1, "product_id": 1})
    assert resp.status_code in (401, 403)


def test_post_inspection_forbidden_for_other_role(client, db, insp_seed):
    resp = client.post("/inspections", headers=_headers_for(db, "viewer"), json={
        "operator_id": insp_seed["op"].id,
        "product_id": insp_seed["product"].id,
    })
    assert resp.status_code == 403


def test_operator_posts_own_inspection(client, db, auth_headers, insp_seed):
    # An operator logs in and submits without operator_id; the server attributes
    # the part to their own linked operator (body cannot spoof it).
    s = insp_seed
    created = client.post("/operators", json={"name": "Bob"}, headers=auth_headers).json()
    login = client.post(
        "/auth/login",
        json={"email": created["username"], "password": created["password"]},
    ).json()
    op_headers = {"Authorization": f"Bearer {login['access_token']}"}

    resp = client.post("/inspections", headers=op_headers, json={
        "product_id": s["product"].id,
        "pmp_defect_type_ids": [s["pmp"].id],
        "inj_defect_type_ids": [],
    })
    assert resp.status_code == 201
    part_id = resp.json()["part_inspection_id"]
    db.expire_all()
    rows = db.query(InspectionLog).filter(InspectionLog.part_inspection_id == part_id).all()
    assert rows
    assert all(r.operator_id == created["id"] for r in rows)
