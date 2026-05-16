import app.feature_flags as flag_cache


def _put(client, headers, name, enabled=True, description=None):
    body = {"enabled": enabled}
    if description is not None:
        body["description"] = description
    return client.put(f"/flags/{name}", json=body, headers=headers)


def test_list_flags_empty_returns_empty_array(client, auth_headers):
    resp = client.get("/flags", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_put_flag_creates_new_entry(client, auth_headers):
    resp = _put(client, auth_headers, "my_flag", enabled=True, description="a test flag")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "my_flag"
    assert body["enabled"] is True
    assert body["description"] == "a test flag"
    assert "updated_at" in body


def test_put_flag_updates_existing_entry(client, auth_headers):
    _put(client, auth_headers, "toggle_me", enabled=True)
    resp = _put(client, auth_headers, "toggle_me", enabled=False)
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


def test_list_flags_returns_all(client, auth_headers):
    _put(client, auth_headers, "flag_a")
    _put(client, auth_headers, "flag_b")
    resp = client.get("/flags", headers=auth_headers)
    names = [f["name"] for f in resp.json()]
    assert "flag_a" in names
    assert "flag_b" in names


def test_put_flag_rejects_invalid_name_format(client, auth_headers):
    assert _put(client, auth_headers, "BadName").status_code == 422
    assert _put(client, auth_headers, "0starts_with_digit").status_code == 422
    assert _put(client, auth_headers, "has-hyphen").status_code == 422
    assert _put(client, auth_headers, "a" * 65).status_code == 422


def test_is_enabled_returns_true_after_upsert(client, auth_headers):
    flag_cache.reset_cache()
    assert flag_cache.is_enabled("live_flag") is False
    _put(client, auth_headers, "live_flag", enabled=True)
    flag_cache.reset_cache()
    assert flag_cache.is_enabled("live_flag") is True


def test_is_enabled_returns_default_for_unknown_flag(client, auth_headers):
    flag_cache.reset_cache()
    assert flag_cache.is_enabled("no_such_flag") is False
    assert flag_cache.is_enabled("no_such_flag", default=True) is True


def test_flag_endpoints_require_auth(client):
    assert client.get("/flags").status_code == 401
    assert client.put("/flags/some_flag", json={"enabled": True}).status_code == 401
