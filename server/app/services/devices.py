from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.device import Device


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def heartbeat(db: Session, device_id: str, name: str | None = None) -> Device:
    """Upsert a station's presence: refresh last_seen (so `online` stays true
    while the tablet is connected) and record its self-reported name. Web tablets
    call this periodically; the browser can't read the OS device name, so the
    device supplies one."""
    dev = db.get(Device, device_id)
    if dev is None:
        dev = Device(id=device_id, name=name, last_seen=_utc_now())
        db.add(dev)
    else:
        dev.last_seen = _utc_now()
        if name:
            dev.name = name
        if not dev.active:  # a returning device comes back online
            dev.active = True
            dev.archived_at = None
    db.commit()
    db.refresh(dev)
    return dev


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
