from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

# Aligned with docs/api-spec.md and CLAUDE.md devices section:
# a device is "online" if its status heartbeat arrived within the last 90s.
# STM32 firmware publishes status every 30s, so 90s = 3 missed heartbeats.
ONLINE_THRESHOLD_SECONDS = 90


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    last_seen: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    config_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    operator_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    first_seen: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    @property
    def online(self) -> bool:
        if self.last_seen is None:
            return False
        try:
            last = datetime.fromisoformat(self.last_seen.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - last) < timedelta(seconds=ONLINE_THRESHOLD_SECONDS)
        except (ValueError, TypeError):
            return False
