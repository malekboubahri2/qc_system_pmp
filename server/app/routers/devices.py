from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.device import DeviceRead
from app.schemas.live import LiveStationsResponse
from app.services import devices as svc
from app.services import live_stations as live_svc

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceRead])
def list_devices(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return svc.get_all(db)


# Must precede /{device_id} so "live" isn't captured as a device id.
@router.get("/live", response_model=LiveStationsResponse)
def live_stations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return live_svc.compute_live(db)


@router.get("/{device_id}", response_model=DeviceRead)
def get_device(
    device_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_by_id(db, device_id)
