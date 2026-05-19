from __future__ import annotations
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.product import Product
from sqlalchemy import String, Integer, Boolean, CheckConstraint, Index, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.constants import CATEGORY_KIND_VALUES


class DefectType(Base):
    __tablename__ = "defect_types"
    __table_args__ = (
        CheckConstraint(
            f"category_kind IN ({', '.join(repr(v) for v in CATEGORY_KIND_VALUES)})",
            name="ck_defect_types_category_kind",
        ),
        Index("idx_defect_types_product_cat", "product_id", "category_kind", "active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    category_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(24), nullable=False)
    is_other_fallback: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    product: Mapped["Product"] = relationship(  # type: ignore[name-defined]
        "Product", back_populates="defect_types"
    )


class DefectLog(Base):
    __tablename__ = "defect_logs"
    __table_args__ = (
        Index("idx_defect_logs_received_at", "received_at"),
        Index("idx_defect_logs_logged_at", "logged_at"),
        Index("idx_defect_logs_operator", "operator_id"),
        Index("idx_defect_logs_defect_type", "defect_type_id"),
        Index("idx_defect_logs_device", "device_id"),
        Index("idx_defect_logs_product", "product_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id"), nullable=False)
    operator_id: Mapped[int] = mapped_column(Integer, ForeignKey("operators.id"), nullable=False)
    defect_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("defect_types.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(140), nullable=True)
    logged_at: Mapped[str] = mapped_column(String, nullable=False)
    received_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )
