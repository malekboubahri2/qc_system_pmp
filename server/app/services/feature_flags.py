from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.feature_flag import FeatureFlag
import app.feature_flags as flag_cache


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def list_all(db: Session) -> list[FeatureFlag]:
    return db.query(FeatureFlag).order_by(FeatureFlag.name).all()


def get(db: Session, name: str) -> FeatureFlag | None:
    return db.query(FeatureFlag).filter(FeatureFlag.name == name).first()


def upsert(db: Session, name: str, enabled: bool, description: str | None) -> FeatureFlag:
    flag = get(db, name)
    if flag is None:
        flag = FeatureFlag(name=name, enabled=enabled, description=description, updated_at=_utc_now())
        db.add(flag)
    else:
        flag.enabled = enabled
        flag.description = description
        flag.updated_at = _utc_now()
    db.commit()
    db.refresh(flag)
    flag_cache.reset_cache()
    return flag
