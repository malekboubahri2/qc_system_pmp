from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db
from app.mqtt import bridge as mqtt_bridge
from app.mqtt.schemas import SCHEMA_VERSION_CONFIG
from app.services import devices as device_svc

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/detailed")
def health_detailed(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    mqtt_status = "ok" if mqtt_bridge.is_connected() else "disconnected"

    devices = device_svc.get_all(db)
    device_summary = [
        {
            "id": d.id,
            "online": d.online,
            "last_seen": d.last_seen,
            "config_version": d.config_version,
        }
        for d in devices
    ]

    overall = "ok" if db_status == "ok" and mqtt_status == "ok" else "degraded"

    return {
        "status": overall,
        "db": db_status,
        "mqtt_broker": mqtt_status,
        "config_version": SCHEMA_VERSION_CONFIG,
        "devices": device_summary,
    }
