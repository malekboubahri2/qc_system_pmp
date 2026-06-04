import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.config import settings
from app.models.operator import Operator
from app.models.user import User
from app.schemas.operator import OperatorCreate, OperatorUpdate
from app.security import hash_password, generate_password
from app.services import mqtt_payloads

_OPERATOR_ROLE = "operator"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Username generation ──────────────────────────────────────────────────────

def _slug(name: str) -> str:
    """A typeable login id from a (possibly accented) display name."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", ".", ascii_name).strip(".").lower()
    return slug or "operateur"


def _unique_username(db: Session, base: str) -> str:
    candidate = base
    i = 1
    while db.query(User).filter(User.email == candidate).first() is not None:
        i += 1
        candidate = f"{base}{i}"
    return candidate


# ── Queries ──────────────────────────────────────────────────────────────────

def get_all(db: Session, active_only: bool = True) -> list[Operator]:
    q = db.query(Operator)
    if active_only:
        q = q.filter(Operator.active.is_(True))
    return q.order_by(Operator.id).all()


def get_by_id(db: Session, operator_id: int) -> Operator:
    op = db.get(Operator, operator_id)
    if op is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")
    return op


def operator_for_user(db: Session, user_id: int) -> Optional[Operator]:
    """The operator owned by a login user, or None (e.g. for admins)."""
    return db.query(Operator).filter(Operator.user_id == user_id).first()


def operator_id_for_user(db: Session, user_id: int) -> Optional[int]:
    op = operator_for_user(db, user_id)
    return op.id if op else None


# ── Mutations ────────────────────────────────────────────────────────────────

def create(db: Session, data: OperatorCreate) -> tuple[Operator, str, str]:
    """Create an operator and its login account (role `operator`). Returns the
    operator plus the generated username and password — the credentials are
    revealed exactly once; only the password hash is stored (ADR-018)."""
    username = _unique_username(db, _slug(data.name))
    password = generate_password(settings.operator_password_length)
    user = User(email=username, password_hash=hash_password(password), role=_OPERATOR_ROLE)
    db.add(user)
    db.flush()
    op = Operator(name=data.name, user_id=user.id)
    db.add(op)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op, username, password


def update(db: Session, operator_id: int, data: OperatorUpdate) -> Operator:
    op = get_by_id(db, operator_id)
    if data.name is not None:
        op.name = data.name
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op


def regenerate_password(db: Session, operator_id: int) -> tuple[Operator, str, str]:
    """Rotate the operator's login password (reveal once). Back-fills a login
    account for legacy operators that predate ADR-018."""
    op = get_by_id(db, operator_id)
    if op.user_id is None:
        username = _unique_username(db, _slug(op.name))
        user = User(email=username, password_hash="", role=_OPERATOR_ROLE)
        db.add(user)
        db.flush()
        op.user_id = user.id
    else:
        user = db.get(User, op.user_id)
        if user is None:  # dangling link — recreate
            username = _unique_username(db, _slug(op.name))
            user = User(email=username, password_hash="", role=_OPERATOR_ROLE)
            db.add(user)
            db.flush()
            op.user_id = user.id
    password = generate_password(settings.operator_password_length)
    user.password_hash = hash_password(password)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op, user.email, password


def archive(db: Session, operator_id: int) -> None:
    op = get_by_id(db, operator_id)
    op.active = False
    op.archived_at = _utc_now()
    if op.user_id is not None:  # block login for an archived operator
        user = db.get(User, op.user_id)
        if user is not None:
            user.active = False
    db.commit()
    mqtt_payloads.publish_operator_list()
