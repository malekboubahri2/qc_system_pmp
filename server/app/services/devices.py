from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.device import Device


def get_all(db: Session, active_only: bool = True) -> list[Device]:
    q = db.query(Device)
    if active_only:
        q = q.filter(Device.active.is_(True))
    return q.order_by(Device.id).all()


def get_by_id(db: Session, device_id: str) -> Device:
    dev = db.get(Device, device_id)
    if dev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return dev
