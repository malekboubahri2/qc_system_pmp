from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, Index, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class DefectCategory(Base):
    __tablename__ = "defect_categories"
    __table_args__ = (Index("idx_defect_categories_active", "active"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    defect_types: Mapped[List["DefectType"]] = relationship(
        "DefectType", back_populates="category", lazy="select"
    )


class DefectType(Base):
    __tablename__ = "defect_types"
    __table_args__ = (Index("idx_defect_types_category", "category_id", "active"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("defect_categories.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(24), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )

    category: Mapped["DefectCategory"] = relationship(
        "DefectCategory", back_populates="defect_types"
    )


class DefectLog(Base):
    __tablename__ = "defect_logs"
    __table_args__ = (
        Index("idx_defect_logs_received_at", "received_at"),
        Index("idx_defect_logs_logged_at", "logged_at"),
        Index("idx_defect_logs_operator", "operator_id"),
        Index("idx_defect_logs_defect_type", "defect_type_id"),
        Index("idx_defect_logs_device", "device_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id"), nullable=False)
    operator_id: Mapped[int] = mapped_column(Integer, ForeignKey("operators.id"), nullable=False)
    defect_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("defect_types.id"), nullable=False)
    product_ref: Mapped[str] = mapped_column(String, nullable=False)
    logged_at: Mapped[str] = mapped_column(String, nullable=False)
    received_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"),
    )
