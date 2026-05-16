"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-16

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TS_DEFAULT = "(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"


def upgrade() -> None:
    op.create_table(
        "operators",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("pin_hash", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_operators_active", "operators", ["active"])

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

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="'admin'"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_users_email", "users", ["email"])

    op.create_table(
        "feature_flags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )

    op.create_table(
        "devices",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("last_seen", sa.String(), nullable=True),
        sa.Column("config_version", sa.Integer(), nullable=True),
        sa.Column("operator_version", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("archived_at", sa.String(), nullable=True),
        sa.Column("first_seen", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )

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

    op.create_table(
        "defect_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.String(), sa.ForeignKey("devices.id"), nullable=False),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("operators.id"), nullable=False),
        sa.Column("defect_type_id", sa.Integer(), sa.ForeignKey("defect_types.id"), nullable=False),
        sa.Column("product_ref", sa.String(), nullable=False),
        sa.Column("logged_at", sa.String(), nullable=False),
        sa.Column("received_at", sa.String(), nullable=False, server_default=sa.text(_TS_DEFAULT)),
    )
    op.create_index("idx_defect_logs_received_at", "defect_logs", ["received_at"])
    op.create_index("idx_defect_logs_logged_at", "defect_logs", ["logged_at"])
    op.create_index("idx_defect_logs_operator", "defect_logs", ["operator_id"])
    op.create_index("idx_defect_logs_defect_type", "defect_logs", ["defect_type_id"])
    op.create_index("idx_defect_logs_device", "defect_logs", ["device_id"])


def downgrade() -> None:
    op.drop_table("defect_logs")
    op.drop_table("defect_types")
    op.drop_table("devices")
    op.drop_table("feature_flags")
    op.drop_table("users")
    op.drop_table("defect_categories")
    op.drop_table("operators")
