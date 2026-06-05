import itertools
from unittest.mock import patch

_mat = itertools.count(1)


def _create(client, headers, name="Mohammed", matricule=None, **extra):
    if matricule is None:
        matricule = f"M{next(_mat):04d}"
    body = {"matricule": matricule, "name": name, **extra}
    return client.post("/operators", json=body, headers=headers)


def _login(client, username, password):
    return client.post("/auth/login", json={"email": username, "password": password})


def test_list_operators_empty(client, auth_headers):
    resp = client.get("/operators", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_operator_returns_credentials_once(client, auth_headers):
    resp = _create(client, auth_headers, matricule="EMP-0427",
                   last_name="Benali", phone="55123456")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Mohammed"
    assert body["last_name"] == "Benali"
    assert body["matricule"] == "EMP-0427"
    assert body["username"] == "EMP-0427"   # matricule is the login
    assert body["active"] is True
    assert body["has_login"] is True
    assert body["password"]                 # plaintext, returned once
    assert "password_hash" not in body


def test_created_operator_can_log_in(client, auth_headers):
    body = _create(client, auth_headers, "Sofia").json()
    resp = _login(client, body["username"], body["password"])
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_duplicate_matricule_rejected(client, auth_headers):
    assert _create(client, auth_headers, "Ali", matricule="DUP").status_code == 201
    assert _create(client, auth_headers, "Karim", matricule="DUP").status_code == 409


def test_get_operator_exposes_login_not_password(client, auth_headers):
    created = _create(client, auth_headers, "Yasmine").json()
    got = client.get(f"/operators/{created['id']}", headers=auth_headers).json()
    assert got["name"] == "Yasmine"
    assert got["has_login"] is True
    assert got["username"] == created["username"]
    assert "password" not in got


def test_get_operator_not_found(client, auth_headers):
    assert client.get("/operators/9999", headers=auth_headers).status_code == 404


def test_update_operator_name(client, auth_headers):
    created = _create(client, auth_headers, "OldName").json()
    resp = client.patch(
        f"/operators/{created['id']}", json={"name": "NewName"}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


def test_regenerate_password_rotates_login(client, auth_headers):
    op = _create(client, auth_headers, "Rotate").json()
    old = op["password"]
    resp = client.post(f"/operators/{op['id']}/regenerate-password", headers=auth_headers)
    assert resp.status_code == 200
    new = resp.json()["password"]
    assert new != old
    assert _login(client, op["username"], old).status_code == 401
    assert _login(client, op["username"], new).status_code == 200


def test_archive_blocks_operator_login(client, auth_headers):
    op = _create(client, auth_headers, "Temp").json()
    assert _login(client, op["username"], op["password"]).status_code == 200
    assert client.delete(f"/operators/{op['id']}", headers=auth_headers).status_code == 204
    assert _login(client, op["username"], op["password"]).status_code == 401


def test_create_operator_triggers_mqtt_publish(client, auth_headers):
    with patch("app.services.mqtt_payloads.publish_operator_list") as mock_pub:
        assert _create(client, auth_headers, "Charlie").status_code == 201
        mock_pub.assert_called_once()


def test_list_excludes_archived_by_default(client, auth_headers):
    created = _create(client, auth_headers, "ToArchive").json()
    client.delete(f"/operators/{created['id']}", headers=auth_headers)
    listing = client.get("/operators", headers=auth_headers).json()
    assert all(op["id"] != created["id"] for op in listing)


def test_list_includes_archived_when_requested(client, auth_headers):
    created = _create(client, auth_headers, "Archived").json()
    client.delete(f"/operators/{created['id']}", headers=auth_headers)
    listing = client.get("/operators?include_archived=true", headers=auth_headers).json()
    assert any(op["id"] == created["id"] for op in listing)


def test_operator_me_returns_operator_id(client, auth_headers):
    op = _create(client, auth_headers, "Mehdi").json()
    token = _login(client, op["username"], op["password"]).json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["role"] == "operator"
    assert me["operator_id"] == op["id"]


def test_admin_me_has_no_operator_id(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()
    assert me["role"] == "admin"
    assert me["operator_id"] is None


def test_requires_auth(client):
    assert client.get("/operators").status_code == 401
