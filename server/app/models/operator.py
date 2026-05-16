from typing import Optional
from sqlalchemy import String, Boolean, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Operator(Base):
    __tablename__ = "operators"
    __table_args__ = (Index("idx_operators_active", "active"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pin_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    @property
    def pin_set(self) -> bool:
        return self.pin_hash is not None
