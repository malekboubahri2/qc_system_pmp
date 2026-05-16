import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set env vars BEFORE any app module is imported so Settings() picks them up.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("JWT_SECRET", "test-secret-32-chars-min-required!")
os.environ.setdefault("MQTT_PASSWORD", "test-pass")

from app.models.base import Base  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402

# StaticPool: all sessions/connections share one in-memory SQLite database.
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(_engine, "connect")
def _pragmas(conn, _):
    c = conn.cursor()
    c.execute("PRAGMA foreign_keys=ON")
    c.close()

_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(autouse=True)
def _setup_db():
    Base.metadata.create_all(_engine)
    yield
    Base.metadata.drop_all(_engine)


@pytest.fixture
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_session] = _override
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    from app.models.user import User
    from app.security import hash_password
    user = User(email="admin@test.com", password_hash=hash_password("testpass"), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    from app.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(str(test_user.id))}"}
