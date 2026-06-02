"""per-part inspection: category_kind + part_inspection_id

Adds an explicit category to every inspection row and a part grouping id so a
full part inspection (PMP + INJECTION published as one message) expands into
rows that can be attributed per category and counted per part for Taux NC.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inspection_logs", sa.Column("category_kind", sa.String(length=32), nullable=True))
    op.add_column("inspection_logs", sa.Column("part_inspection_id", sa.String(), nullable=True))
    op.create_index(
        "ix_inspection_logs_part_inspection_id",
        "inspection_logs",
        ["part_inspection_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_inspection_logs_part_inspection_id", table_name="inspection_logs")
    op.drop_column("inspection_logs", "part_inspection_id")
    op.drop_column("inspection_logs", "category_kind")
