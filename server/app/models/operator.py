from typing import Optional
from sqlalchemy import String, Boolean, Integer, Index, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Operator(Base):
    __tablename__ = "operators"
    __table_args__ = (Index("idx_operators_active", "active"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Login account that owns this operator (role `operator`). Operators sign in
    # with username + password; this links attribution to their user (ADR-018).
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, unique=True
    )
    # Legacy: PIN auth is retired for the PWA (ADR-018). Kept nullable for the
    # historical MQTT operators config; the web flow no longer sets it.
    pin_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    # Eager-loaded so listing operators with their login is a single query.
    user = relationship("User", lazy="joined")

    @property
    def pin_set(self) -> bool:
        return self.pin_hash is not None

    @property
    def username(self) -> Optional[str]:
        """The operator's login id (their user's email), or None if unlinked."""
        return self.user.email if self.user else None

    @property
    def has_login(self) -> bool:
        return self.user_id is not None
