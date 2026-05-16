def test_login_returns_token(client, test_user):
    resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "testpass"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post("/auth/login", json={"email": "nobody@test.com", "password": "pw"})
    assert resp.status_code == 401


def test_me_returns_user(client, test_user, auth_headers):
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "admin@test.com"
    assert body["role"] == "admin"


def test_me_requires_auth(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 403
