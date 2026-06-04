from unittest.mock import patch


def _create(client, headers, name="Mohammed"):
    return client.post("/operators", json={"name": name}, headers=headers)


def _set_pin(client, headers, operator_id, pin="1234"):
    return client.post(f"/operators/{operator_id}/pin", json={"pin": pin}, headers=headers)


def test_list_operators_empty(client, auth_headers):
    resp = client.get("/operators", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_operator_without_pin_returns_pin_set_false(client, auth_headers):
    resp = _create(client, auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Mohammed"
    assert body["active"] is True
    assert body["pin_set"] is False
    assert "pin_hash" not in body


def test_create_operator(client, auth_headers):
    resp = _create(client, auth_headers)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Mohammed"


def test_get_operator(client, auth_headers):
    created = _create(client, auth_headers, "Yasmine").json()
    resp = client.get(f"/operators/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Yasmine"


def test_get_operator_not_found(client, auth_headers):
    resp = client.get("/operators/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_update_operator_name(client, auth_headers):
    created = _create(client, auth_headers, "OldName").json()
    resp = client.patch(
        f"/operators/{created['id']}",
        json={"name": "NewName"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


def test_set_pin_returns_204_no_body(client, auth_headers):
    created = _create(client, auth_headers, "Alice").json()
    resp = _set_pin(client, auth_headers, created["id"])
    assert resp.status_code == 204
    assert resp.content == b""


def test_set_pin(client, auth_headers):
    created = _create(client, auth_headers, "Alice").json()
    _set_pin(client, auth_headers, created["id"], "9999")
    updated = client.get(f"/operators/{created['id']}", headers=auth_headers).json()
    assert updated["pin_set"] is True


def test_set_pin_triggers_mqtt_publish(client, auth_headers):
    created = _create(client, auth_headers, "Bob").json()
    with patch("app.services.mqtt_payloads.publish_operator_list") as mock_pub:
        resp = _set_pin(client, auth_headers, created["id"])
        assert resp.status_code == 204
        mock_pub.assert_called_once()


def test_create_operator_does_not_trigger_mqtt_publish(client, auth_headers):
    with patch("app.services.mqtt_payloads.publish_operator_list") as mock_pub:
        resp = _create(client, auth_headers, "Charlie")
        assert resp.status_code == 201
        mock_pub.assert_not_called()


def test_pin_must_be_numeric_4_to_8_digits(client, auth_headers):
    created = _create(client, auth_headers).json()
    op_id = created["id"]
    assert _set_pin(client, auth_headers, op_id, "abc").status_code == 422
    assert _set_pin(client, auth_headers, op_id, "123").status_code == 422
    assert _set_pin(client, auth_headers, op_id, "123456789").status_code == 422
    assert _set_pin(client, auth_headers, op_id, "1234").status_code == 204


def test_archive_operator(client, auth_headers):
    created = _create(client, auth_headers, "TempOp").json()
    resp = client.delete(f"/operators/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204
    listing = client.get("/operators", headers=auth_headers).json()
    assert all(op["id"] != created["id"] for op in listing)


def test_list_operators_excludes_archived_by_default(client, auth_headers):
    created = _create(client, auth_headers, "ToArchive").json()
    client.delete(f"/operators/{created['id']}", headers=auth_headers)
    listing = client.get("/operators", headers=auth_headers).json()
    assert all(op["id"] != created["id"] for op in listing)


def test_list_operators_includes_archived_when_requested(client, auth_headers):
    created = _create(client, auth_headers, "Archived").json()
    client.delete(f"/operators/{created['id']}", headers=auth_headers)
    listing = client.get("/operators?include_archived=true", headers=auth_headers).json()
    assert any(op["id"] == created["id"] for op in listing)


def test_requires_auth(client):
    assert client.get("/operators").status_code == 401


# ── PIN verification (PWA login step) ───────────────────────────────────────

def test_verify_pin_correct(client, auth_headers):
    op = _create(client, auth_headers, "Dana").json()
    _set_pin(client, auth_headers, op["id"], "4321")
    resp = client.post("/operators/verify-pin",
                       json={"operator_id": op["id"], "pin": "4321"}, headers=auth_headers)
    assert resp.status_code == 204


def test_verify_pin_wrong(client, auth_headers):
    op = _create(client, auth_headers, "Eli").json()
    _set_pin(client, auth_headers, op["id"], "4321")
    resp = client.post("/operators/verify-pin",
                       json={"operator_id": op["id"], "pin": "0000"}, headers=auth_headers)
    assert resp.status_code == 401


def test_verify_pin_unknown_operator(client, auth_headers):
    resp = client.post("/operators/verify-pin",
                       json={"operator_id": 99999, "pin": "1234"}, headers=auth_headers)
    assert resp.status_code == 401


def test_verify_pin_no_pin_set(client, db, auth_headers):
    from app.models.operator import Operator
    op = Operator(name="NoPin", pin_hash=None)
    db.add(op)
    db.commit()
    db.refresh(op)
    resp = client.post("/operators/verify-pin",
                       json={"operator_id": op.id, "pin": "1234"}, headers=auth_headers)
    assert resp.status_code == 401
