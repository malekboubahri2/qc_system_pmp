"""Product cheatsheet document: upload / serve / delete + validation + auth."""
import pytest

from app.config import settings
from app.models.user import User
from app.security import hash_password, create_access_token

_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


@pytest.fixture(autouse=True)
def _tmp_upload_dir(tmp_path, monkeypatch):
    """Write uploads to a throwaway dir instead of /var/lib/qc/uploads."""
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))


def _headers_for(db, role: str) -> dict:
    user = User(email=f"{role}@cheatsheet.test", password_hash=hash_password("x"), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _make_product(client, headers) -> int:
    return client.post("/products", json={"name": "Capot"}, headers=headers).json()["id"]


def test_upload_get_delete_roundtrip(client, db, auth_headers):
    pid = _make_product(client, auth_headers)

    up = client.post(
        f"/products/{pid}/cheatsheet",
        files={"file": ("fiche.pdf", _PDF, "application/pdf")},
        headers=auth_headers,
    )
    assert up.status_code == 200, up.text
    body = up.json()
    assert body["has_cheatsheet_file"] is True
    assert body["cheatsheet_name"] == "fiche.pdf"

    # Listing/detail reflect it.
    assert client.get(f"/products/{pid}", headers=auth_headers).json()["has_cheatsheet_file"] is True

    got = client.get(f"/products/{pid}/cheatsheet", headers=auth_headers)
    assert got.status_code == 200
    assert got.headers["content-type"].startswith("application/pdf")
    assert got.content == _PDF

    assert client.delete(f"/products/{pid}/cheatsheet", headers=auth_headers).status_code == 204
    assert client.get(f"/products/{pid}/cheatsheet", headers=auth_headers).status_code == 404
    assert client.get(f"/products/{pid}", headers=auth_headers).json()["has_cheatsheet_file"] is False


def test_get_404_when_none(client, auth_headers):
    pid = _make_product(client, auth_headers)
    assert client.get(f"/products/{pid}/cheatsheet", headers=auth_headers).status_code == 404


def test_reject_unsupported_type(client, auth_headers):
    pid = _make_product(client, auth_headers)
    r = client.post(
        f"/products/{pid}/cheatsheet",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )
    assert r.status_code == 415


def test_reject_oversize(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "cheatsheet_max_bytes", 8)
    pid = _make_product(client, auth_headers)
    r = client.post(
        f"/products/{pid}/cheatsheet",
        files={"file": ("big.pdf", b"%PDF-" + b"x" * 50, "application/pdf")},
        headers=auth_headers,
    )
    assert r.status_code == 413


def test_operator_cannot_upload_but_can_read(client, db, auth_headers):
    pid = _make_product(client, auth_headers)
    op = _headers_for(db, "operator")
    # Operator upload is forbidden…
    forbidden = client.post(
        f"/products/{pid}/cheatsheet",
        files={"file": ("fiche.pdf", _PDF, "application/pdf")},
        headers=op,
    )
    assert forbidden.status_code == 403
    # …but once admin attaches it, the operator can read it (reference material).
    client.post(
        f"/products/{pid}/cheatsheet",
        files={"file": ("fiche.pdf", _PDF, "application/pdf")},
        headers=auth_headers,
    )
    assert client.get(f"/products/{pid}/cheatsheet", headers=op).status_code == 200
