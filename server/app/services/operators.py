from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.models.operator import Operator
from app.schemas.operator import OperatorCreate, OperatorUpdate
from app.security import hash_pin, verify_pin as _pin_matches, generate_numeric_pin
from app.services import mqtt_payloads

_PIN_MAX_ATTEMPTS = 100


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _pin_in_use(db: Session, pin: str, exclude_operator_id: int | None = None) -> bool:
    """True if `pin` already belongs to an active operator (excluding one id).
    PINs are salted-hashed, so uniqueness can only be checked by verifying the
    candidate against each stored hash — fine at PoC scale (a few operators)."""
    q = db.query(Operator).filter(Operator.active.is_(True), Operator.pin_hash.isnot(None))
    if exclude_operator_id is not None:
        q = q.filter(Operator.id != exclude_operator_id)
    return any(_pin_matches(pin, op.pin_hash) for op in q.all())


def _generate_unique_pin(db: Session, exclude_operator_id: int | None = None) -> str:
    """Mint a CSPRNG numeric PIN unique among active operators."""
    for _ in range(_PIN_MAX_ATTEMPTS):
        pin = generate_numeric_pin(settings.operator_pin_length)
        if not _pin_in_use(db, pin, exclude_operator_id):
            return pin
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not allocate a unique PIN; widen OPERATOR_PIN_LENGTH",
    )


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


def create(db: Session, data: OperatorCreate) -> tuple[Operator, str]:
    """Create an operator with an auto-generated unique PIN. Returns the
    operator and the plaintext PIN — the ONLY time the PIN is exposed; only
    its hash is stored. The operator is immediately eligible for use, so the
    retained operators config is republished."""
    pin = _generate_unique_pin(db)
    op = Operator(name=data.name, pin_hash=hash_pin(pin))
    db.add(op)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op, pin


def update(db: Session, operator_id: int, data: OperatorUpdate) -> Operator:
    op = get_by_id(db, operator_id)
    if data.name is not None:
        op.name = data.name
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op


def set_pin(db: Session, operator_id: int, pin: str) -> None:
    op = get_by_id(db, operator_id)
    op.pin_hash = hash_pin(pin)
    db.commit()
    mqtt_payloads.publish_operator_list()


def regenerate_pin(db: Session, operator_id: int) -> tuple[Operator, str]:
    """Rotate an operator's PIN to a fresh unique value. Returns the operator
    and the new plaintext PIN (reveal once). Republishes the operators config."""
    op = get_by_id(db, operator_id)
    pin = _generate_unique_pin(db, exclude_operator_id=op.id)
    op.pin_hash = hash_pin(pin)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op, pin


def verify_pin(db: Session, operator_id: int, pin: str) -> bool:
    """True iff `pin` matches an active operator's stored hash. Used by the PWA
    login step. Same negative result for a missing operator and a wrong PIN, so
    it does not leak which operators exist."""
    op = db.get(Operator, operator_id)
    if op is None or not op.active or op.pin_hash is None:
        return False
    return _pin_matches(pin, op.pin_hash)


def archive(db: Session, operator_id: int) -> None:
    op = get_by_id(db, operator_id)
    op.active = False
    op.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_operator_list()
