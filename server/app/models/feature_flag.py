from typing import Optional
from sqlalchemy import String, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )
