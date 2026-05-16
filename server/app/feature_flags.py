import time
import threading
from loguru import logger
from app.config import settings

_cache: dict[str, bool] = {}
_cache_expires: float = 0.0
_lock = threading.Lock()


def _refresh() -> None:
    global _cache, _cache_expires
    from app.db import SessionLocal
    from app.models.feature_flag import FeatureFlag

    with SessionLocal() as session:
        flags = session.query(FeatureFlag).all()
        _cache = {f.name: bool(f.enabled) for f in flags}
    _cache_expires = time.monotonic() + settings.feature_flags_refresh_secs
    logger.debug("Feature flags refreshed count={}", len(_cache))


def is_enabled(name: str, default: bool = False) -> bool:
    with _lock:
        if time.monotonic() >= _cache_expires:
            try:
                _refresh()
            except Exception as exc:
                logger.warning("Feature flag refresh failed: {}", exc)
    return _cache.get(name, default)
