"""product-scoped defect model (ADR-013)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TS_DEFAULT = "(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"


def upgrade() -> None:
    # 1. Create products table.
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_products_active", "products", ["active"])

    # 2. Drop defect_categories (no longer a table — categories are an enum in constants.py).
    op.drop_table("defect_categories")

    # 3. Recreate defect_types with new schema.
    #    SQLite does not support DROP COLUMN or ALTER COLUMN, so we drop and recreate.
    op.drop_index("idx_defect_types_category", table_name="defect_types")
    op.drop_table("defect_types")

    op.create_table(
        "defect_types",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("category_kind", sa.String(32), nullable=False),
        sa.Column("label", sa.String(24), nullable=False),
        sa.Column("is_other_fallback", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
        sa.CheckConstraint("category_kind IN ('PMP', 'INJECTION')", name="ck_defect_types_category_kind"),
    )
    op.create_index(
        "idx_defect_types_product_cat", "defect_types",
        ["product_id", "category_kind", "active"],
    )

    # 4. Truncate and alter defect_logs.
    #    Drop old indexes, truncate (SQLite: delete all), drop old columns, add new ones.
    #    SQLite lacks ALTER COLUMN, so we recreate the table.
    op.drop_index("idx_defect_logs_received_at", table_name="defect_logs")
    op.drop_index("idx_defect_logs_logged_at", table_name="defect_logs")
    op.drop_index("idx_defect_logs_operator", table_name="defect_logs")
    op.drop_index("idx_defect_logs_defect_type", table_name="defect_logs")
    op.drop_index("idx_defect_logs_device", table_name="defect_logs")
    op.drop_table("defect_logs")

    op.create_table(
        "defect_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.String(), sa.ForeignKey("devices.id"), nullable=False),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("operators.id"), nullable=False),
        sa.Column("defect_type_id", sa.Integer(), sa.ForeignKey("defect_types.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("note", sa.String(140), nullable=True),
        sa.Column("logged_at", sa.String(), nullable=False),
        sa.Column("received_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_defect_logs_received_at", "defect_logs", ["received_at"])
    op.create_index("idx_defect_logs_logged_at", "defect_logs", ["logged_at"])
    op.create_index("idx_defect_logs_operator", "defect_logs", ["operator_id"])
    op.create_index("idx_defect_logs_defect_type", "defect_logs", ["defect_type_id"])
    op.create_index("idx_defect_logs_device", "defect_logs", ["device_id"])
    op.create_index("idx_defect_logs_product", "defect_logs", ["product_id"])


def downgrade() -> None:
    # Recreate old defect_logs
    op.drop_index("idx_defect_logs_product", table_name="defect_logs")
    op.drop_index("idx_defect_logs_device", table_name="defect_logs")
    op.drop_index("idx_defect_logs_defect_type", table_name="defect_logs")
    op.drop_index("idx_defect_logs_operator", table_name="defect_logs")
    op.drop_index("idx_defect_logs_logged_at", table_name="defect_logs")
    op.drop_index("idx_defect_logs_received_at", table_name="defect_logs")
    op.drop_table("defect_logs")

    op.create_table(
        "defect_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.String(), sa.ForeignKey("devices.id"), nullable=False),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("operators.id"), nullable=False),
        sa.Column("defect_type_id", sa.Integer(), sa.ForeignKey("defect_types.id"), nullable=False),
        sa.Column("product_ref", sa.String(), nullable=False),
        sa.Column("logged_at", sa.String(), nullable=False),
        sa.Column(
            "received_at", sa.String(), nullable=False,
            server_default=sa.text(_TS_DEFAULT),
        ),
    )
    op.create_index("idx_defect_logs_received_at", "defect_logs", ["received_at"])
    op.create_index("idx_defect_logs_logged_at", "defect_logs", ["logged_at"])
    op.create_index("idx_defect_logs_operator", "defect_logs", ["operator_id"])
    op.create_index("idx_defect_logs_defect_type", "defect_logs", ["defect_type_id"])
    op.create_index("idx_defect_logs_device", "defect_logs", ["device_id"])

    # Recreate old defect_types
    op.drop_index("idx_defect_types_product_cat", table_name="defect_types")
    op.drop_table("defect_types")

    op.create_table(
        "defect_types",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("defect_categories.id"), nullable=False),
        sa.Column("label", sa.String(24), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_defect_types_category", "defect_types", ["category_id", "active"])

    # Recreate defect_categories
    op.create_table(
        "defect_categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_defect_categories_active", "defect_categories", ["active"])

    # Drop products
    op.drop_index("idx_products_active", table_name="products")
    op.drop_table("products")
