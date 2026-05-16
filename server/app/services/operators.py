from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.operator import Operator
from app.schemas.operator import OperatorCreate, OperatorUpdate
from app.security import hash_pin
from app.services import mqtt_payloads


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


def create(db: Session, data: OperatorCreate) -> Operator:
    op = Operator(name=data.name, pin_hash=hash_pin(data.pin))
    db.add(op)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op


def update(db: Session, operator_id: int, data: OperatorUpdate) -> Operator:
    op = get_by_id(db, operator_id)
    if data.name is not None:
        op.name = data.name
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op


def set_pin(db: Session, operator_id: int, pin: str) -> Operator:
    op = get_by_id(db, operator_id)
    op.pin_hash = hash_pin(pin)
    db.commit()
    db.refresh(op)
    mqtt_payloads.publish_operator_list()
    return op


def archive(db: Session, operator_id: int) -> None:
    op = get_by_id(db, operator_id)
    op.active = False
    op.archived_at = _utc_now()
    db.commit()
    mqtt_payloads.publish_operator_list()
