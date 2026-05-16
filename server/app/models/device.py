from typing import Optional
from sqlalchemy import String, Integer, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


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
