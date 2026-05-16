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


def reset_cache() -> None:
    """Expire the cache immediately.

    Call after a write so the same process sees its own changes on the
    next is_enabled() call without waiting for the 30s TTL. Also call
    in tests after DB writes to avoid stale reads.
    """
    global _cache_expires
    with _lock:
        _cache.clear()
        _cache_expires = 0.0
