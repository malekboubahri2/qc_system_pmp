from __future__ import annotations
from typing import TYPE_CHECKING, Optional, List

if TYPE_CHECKING:
    from app.models.defect import DefectType
from sqlalchemy import String, Boolean, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (Index("idx_products_active", "active"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    client: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # Free-text inspection notes / cheatsheet shown on the product page.
    cheatsheet: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Uploaded cheatsheet document (PDF/image): stored filename on disk, its MIME
    # type, and the original upload name. The file lives under settings.upload_dir;
    # only this metadata is in the DB.
    cheatsheet_file: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cheatsheet_mime: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cheatsheet_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    defect_types: Mapped[List["DefectType"]] = relationship(  # type: ignore[name-defined]
        "DefectType", back_populates="product", lazy="select"
    )

    @property
    def has_cheatsheet_file(self) -> bool:
        """True when an uploaded cheatsheet document is attached."""
        return bool(self.cheatsheet_file)
