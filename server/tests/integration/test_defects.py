"""Tests for /products and /products/{id}/defect-types endpoints."""
from app.constants import OTHER_FALLBACK_LABEL, DEFECT_TYPES_PER_CATEGORY_CAP


# ── helpers ───────────────────────────────────────────────────────────────────

def _create_product(client, headers, name="Capot moteur"):
    resp = client.post("/products", json={"name": name}, headers=headers)
    assert resp.status_code == 201, resp.json()
    return resp.json()


def _create_type(client, headers, product_id, label, category_kind="PMP", order=0):
    return client.post(
        f"/products/{product_id}/defect-types",
        json={"category_kind": category_kind, "label": label, "display_order": order},
        headers=headers,
    )


# ── product CRUD ──────────────────────────────────────────────────────────────

def test_create_product(client, auth_headers):
    body = _create_product(client, auth_headers, "Capot moteur")
    assert body["name"] == "Capot moteur"
    assert body["active"] is True


def test_list_products(client, auth_headers):
    _create_product(client, auth_headers, "Prod A")
    _create_product(client, auth_headers, "Prod B")
    resp = client.get("/products", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_product(client, auth_headers):
    p = _create_product(client, auth_headers)
    resp = client.patch(f"/products/{p['id']}", json={"name": "Renamed"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_archive_product(client, auth_headers):
    p = _create_product(client, auth_headers)
    resp = client.delete(f"/products/{p['id']}", headers=auth_headers)
    assert resp.status_code == 204
    listing = client.get("/products", headers=auth_headers).json()
    assert all(x["id"] != p["id"] for x in listing)


def test_get_product_not_found(client, auth_headers):
    assert client.get("/products/9999", headers=auth_headers).status_code == 404


def test_products_requires_auth(client):
    assert client.get("/products").status_code == 401


# ── fallback auto-creation ────────────────────────────────────────────────────

def test_create_product_auto_creates_fallback_types(client, auth_headers):
    p = _create_product(client, auth_headers)
    resp = client.get(f"/products/{p['id']}/defect-types", headers=auth_headers)
    types = resp.json()
    fallbacks = [t for t in types if t["is_other_fallback"]]
    assert len(fallbacks) == 2
    kinds = {t["category_kind"] for t in fallbacks}
    assert kinds == {"PMP", "INJECTION"}
    for f in fallbacks:
        assert f["label"] == OTHER_FALLBACK_LABEL


def test_fallback_cannot_be_archived(client, auth_headers):
    p = _create_product(client, auth_headers)
    types = client.get(f"/products/{p['id']}/defect-types", headers=auth_headers).json()
    fallback = next(t for t in types if t["is_other_fallback"])
    resp = client.delete(
        f"/products/{p['id']}/defect-types/{fallback['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── defect-type CRUD ──────────────────────────────────────────────────────────

def test_create_defect_type(client, auth_headers):
    p = _create_product(client, auth_headers)
    resp = _create_type(client, auth_headers, p["id"], "Rayure")
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "Rayure"
    assert body["product_id"] == p["id"]
    assert body["category_kind"] == "PMP"
    assert body["is_other_fallback"] is False


def test_list_types_by_product(client, auth_headers):
    p = _create_product(client, auth_headers)
    _create_type(client, auth_headers, p["id"], "Rayure")
    _create_type(client, auth_headers, p["id"], "Boursouflure")
    resp = client.get(f"/products/{p['id']}/defect-types", headers=auth_headers)
    # 2 user types + 2 fallbacks auto-created on product creation
    assert len(resp.json()) == 4


def test_list_types_filter_by_category(client, auth_headers):
    p = _create_product(client, auth_headers)
    _create_type(client, auth_headers, p["id"], "PMP type", "PMP")
    _create_type(client, auth_headers, p["id"], "INJ type", "INJECTION")
    resp = client.get(
        f"/products/{p['id']}/defect-types?category_kind=PMP",
        headers=auth_headers,
    )
    types = resp.json()
    assert all(t["category_kind"] == "PMP" for t in types)
    # 1 user type + 1 fallback
    assert len(types) == 2


def test_update_defect_type(client, auth_headers):
    p = _create_product(client, auth_headers)
    dt = _create_type(client, auth_headers, p["id"], "Old Label").json()
    resp = client.patch(
        f"/products/{p['id']}/defect-types/{dt['id']}",
        json={"label": "New Label"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "New Label"


def test_archive_defect_type(client, auth_headers):
    p = _create_product(client, auth_headers)
    dt = _create_type(client, auth_headers, p["id"], "Temp").json()
    resp = client.delete(
        f"/products/{p['id']}/defect-types/{dt['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 204
    types = client.get(f"/products/{p['id']}/defect-types", headers=auth_headers).json()
    assert all(t["id"] != dt["id"] for t in types)


def test_type_wrong_product_returns_404(client, auth_headers):
    p1 = _create_product(client, auth_headers, "P1")
    p2 = _create_product(client, auth_headers, "P2")
    dt = _create_type(client, auth_headers, p1["id"], "Scratch").json()
    # accessing p1's type via p2's route must 404
    assert client.get(
        f"/products/{p2['id']}/defect-types/{dt['id']}", headers=auth_headers
    ).status_code == 404


# ── 12-per-category cap ───────────────────────────────────────────────────────

def test_cap_rejects_thirteenth_type(client, auth_headers):
    p = _create_product(client, auth_headers)
    for i in range(DEFECT_TYPES_PER_CATEGORY_CAP):
        r = _create_type(client, auth_headers, p["id"], f"Type {i:02d}", "PMP")
        assert r.status_code == 201, f"type {i} failed: {r.json()}"

    resp = _create_type(client, auth_headers, p["id"], "Over Limit", "PMP")
    assert resp.status_code == 409


def test_fallback_does_not_count_toward_cap(client, auth_headers):
    p = _create_product(client, auth_headers)
    # Fill to the cap
    for i in range(DEFECT_TYPES_PER_CATEGORY_CAP):
        _create_type(client, auth_headers, p["id"], f"Type {i:02d}", "PMP")
    # Fallback was already there; we should be exactly at the cap
    resp = _create_type(client, auth_headers, p["id"], "One Too Many", "PMP")
    assert resp.status_code == 409


def test_archived_type_frees_cap_slot(client, auth_headers):
    p = _create_product(client, auth_headers)
    for i in range(DEFECT_TYPES_PER_CATEGORY_CAP):
        _create_type(client, auth_headers, p["id"], f"Type {i:02d}", "PMP")

    # Archive one user type to free a slot
    types = client.get(
        f"/products/{p['id']}/defect-types?category_kind=PMP", headers=auth_headers
    ).json()
    user_type = next(t for t in types if not t["is_other_fallback"])
    client.delete(
        f"/products/{p['id']}/defect-types/{user_type['id']}",
        headers=auth_headers,
    )

    resp = _create_type(client, auth_headers, p["id"], "Replacement", "PMP")
    assert resp.status_code == 201


def test_cap_is_per_category(client, auth_headers):
    """Filling PMP cap does not block INJECTION."""
    p = _create_product(client, auth_headers)
    for i in range(DEFECT_TYPES_PER_CATEGORY_CAP):
        _create_type(client, auth_headers, p["id"], f"PMP {i:02d}", "PMP")
    # INJECTION should still accept new types
    resp = _create_type(client, auth_headers, p["id"], "INJ type", "INJECTION")
    assert resp.status_code == 201


# ── constants endpoint ────────────────────────────────────────────────────────

def test_get_categories_constants(client, auth_headers):
    resp = client.get("/constants/categories", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    kinds = {c["kind"] for c in body}
    assert kinds == {"PMP", "INJECTION"}
    for c in body:
        assert c["display_name"]


def test_constants_no_auth_required(client):
    resp = client.get("/constants/categories")
    assert resp.status_code == 200


# ── include_archived ──────────────────────────────────────────────────────────

def test_list_products_excludes_archived_by_default(client, auth_headers):
    p = _create_product(client, auth_headers, "ToArchive")
    client.delete(f"/products/{p['id']}", headers=auth_headers)
    listing = client.get("/products", headers=auth_headers).json()
    assert all(x["id"] != p["id"] for x in listing)


def test_list_products_includes_archived_when_requested(client, auth_headers):
    p = _create_product(client, auth_headers, "Archived")
    client.delete(f"/products/{p['id']}", headers=auth_headers)
    listing = client.get("/products?include_archived=true", headers=auth_headers).json()
    assert any(x["id"] == p["id"] for x in listing)


def test_list_types_excludes_archived_by_default(client, auth_headers):
    p = _create_product(client, auth_headers)
    dt = _create_type(client, auth_headers, p["id"], "Temp Type").json()
    client.delete(f"/products/{p['id']}/defect-types/{dt['id']}", headers=auth_headers)
    types = client.get(f"/products/{p['id']}/defect-types", headers=auth_headers).json()
    assert all(t["id"] != dt["id"] for t in types)


def test_list_types_includes_archived_when_requested(client, auth_headers):
    p = _create_product(client, auth_headers)
    dt = _create_type(client, auth_headers, p["id"], "Temp Type").json()
    client.delete(f"/products/{p['id']}/defect-types/{dt['id']}", headers=auth_headers)
    types = client.get(
        f"/products/{p['id']}/defect-types?include_archived=true", headers=auth_headers
    ).json()
    assert any(t["id"] == dt["id"] for t in types)
