def test_list_operators_empty(client, auth_headers):
    resp = client.get("/operators", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_operator(client, auth_headers):
    resp = client.post(
        "/operators",
        json={"name": "Mohammed", "pin": "1234"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Mohammed"
    assert body["active"] is True
    assert "pin_hash" not in body  # never exposed via REST


def test_get_operator(client, auth_headers):
    created = client.post(
        "/operators", json={"name": "Yasmine", "pin": "5678"}, headers=auth_headers
    ).json()
    resp = client.get(f"/operators/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Yasmine"


def test_get_operator_not_found(client, auth_headers):
    resp = client.get("/operators/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_update_operator_name(client, auth_headers):
    created = client.post(
        "/operators", json={"name": "OldName", "pin": "0000"}, headers=auth_headers
    ).json()
    resp = client.patch(
        f"/operators/{created['id']}",
        json={"name": "NewName"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


def test_set_pin(client, auth_headers):
    created = client.post(
        "/operators", json={"name": "Alice", "pin": "1111"}, headers=auth_headers
    ).json()
    resp = client.put(
        f"/operators/{created['id']}/pin",
        json={"pin": "9999"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_archive_operator(client, auth_headers):
    created = client.post(
        "/operators", json={"name": "TempOp", "pin": "2222"}, headers=auth_headers
    ).json()
    resp = client.delete(f"/operators/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Archived operator must not appear in the default list.
    listing = client.get("/operators", headers=auth_headers).json()
    assert all(op["id"] != created["id"] for op in listing)


def test_requires_auth(client):
    assert client.get("/operators").status_code == 401
