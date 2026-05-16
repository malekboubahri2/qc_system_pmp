import pytest

# ── helpers ──────────────────────────────────────────────────────────────────

def _create_category(client, headers, name="Surface Defects", order=0):
    resp = client.post(
        "/defect-categories",
        json={"name": name, "display_order": order},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


def _create_type(client, headers, category_id, label, order=0):
    resp = client.post(
        "/defect-types",
        json={"category_id": category_id, "label": label, "display_order": order},
        headers=headers,
    )
    return resp


# ── category CRUD ─────────────────────────────────────────────────────────────

def test_create_category(client, auth_headers):
    body = _create_category(client, auth_headers)
    assert body["name"] == "Surface Defects"
    assert body["active"] is True


def test_list_categories(client, auth_headers):
    _create_category(client, auth_headers, "Cat A", 0)
    _create_category(client, auth_headers, "Cat B", 1)
    resp = client.get("/defect-categories", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_category(client, auth_headers):
    cat = _create_category(client, auth_headers)
    resp = client.patch(
        f"/defect-categories/{cat['id']}",
        json={"name": "Renamed", "display_order": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed"
    assert body["display_order"] == 5


def test_archive_category(client, auth_headers):
    cat = _create_category(client, auth_headers)
    resp = client.delete(f"/defect-categories/{cat['id']}", headers=auth_headers)
    assert resp.status_code == 204
    listing = client.get("/defect-categories", headers=auth_headers).json()
    assert all(c["id"] != cat["id"] for c in listing)


def test_get_category_not_found(client, auth_headers):
    assert client.get("/defect-categories/9999", headers=auth_headers).status_code == 404


# ── defect-type CRUD ──────────────────────────────────────────────────────────

def test_create_defect_type(client, auth_headers):
    cat = _create_category(client, auth_headers)
    resp = _create_type(client, auth_headers, cat["id"], "Scratch")
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "Scratch"
    assert body["category_id"] == cat["id"]


def test_list_types_by_category(client, auth_headers):
    cat = _create_category(client, auth_headers)
    _create_type(client, auth_headers, cat["id"], "Scratch")
    _create_type(client, auth_headers, cat["id"], "Bubble")
    resp = client.get(f"/defect-types?category_id={cat['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_defect_type(client, auth_headers):
    cat = _create_category(client, auth_headers)
    dt = _create_type(client, auth_headers, cat["id"], "Old Label").json()
    resp = client.patch(
        f"/defect-types/{dt['id']}",
        json={"label": "New Label"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "New Label"


def test_archive_defect_type(client, auth_headers):
    cat = _create_category(client, auth_headers)
    dt = _create_type(client, auth_headers, cat["id"], "Temp").json()
    resp = client.delete(f"/defect-types/{dt['id']}", headers=auth_headers)
    assert resp.status_code == 204
    listing = client.get(f"/defect-types?category_id={cat['id']}", headers=auth_headers).json()
    assert all(t["id"] != dt["id"] for t in listing)


# ── 12-per-category cap ───────────────────────────────────────────────────────

def test_cap_rejects_thirteenth_type(client, auth_headers):
    cat = _create_category(client, auth_headers)
    for i in range(12):
        r = _create_type(client, auth_headers, cat["id"], f"Type {i:02d}")
        assert r.status_code == 201, f"type {i} failed: {r.json()}"

    resp = _create_type(client, auth_headers, cat["id"], "Over Limit")
    assert resp.status_code == 409


def test_archived_type_does_not_count_toward_cap(client, auth_headers):
    cat = _create_category(client, auth_headers)
    for i in range(12):
        _create_type(client, auth_headers, cat["id"], f"Type {i:02d}")

    # Archive one to free a slot.
    types = client.get(f"/defect-types?category_id={cat['id']}", headers=auth_headers).json()
    client.delete(f"/defect-types/{types[0]['id']}", headers=auth_headers)

    # Now the 12th active slot should be available again.
    resp = _create_type(client, auth_headers, cat["id"], "Replacement")
    assert resp.status_code == 201


def test_type_unknown_category_returns_404(client, auth_headers):
    resp = _create_type(client, auth_headers, 9999, "Ghost")
    assert resp.status_code == 404
