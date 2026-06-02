"""per-part inspection: category_kind + part_inspection_id

Adds an explicit category to every inspection row and a part grouping id so a
full part inspection (PMP + INJECTION published as one message) expands into
rows that can be attributed per category and counted per part for Taux NC.

Idempotent: during early bring-up these columns were added on a live DB via a
manual ALTER while alembic_version stayed at 0004. Guarding each step on the
live schema lets `alembic upgrade head` self-heal on the next rebuild — it adds
what's missing and skips what already exists — without a manual stamp, and
stays correct for a fresh database.

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

_TABLE = "inspection_logs"
_INDEX = "ix_inspection_logs_part_inspection_id"


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(_TABLE)}


def _indexes() -> set[str]:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(_TABLE)}


def upgrade() -> None:
    columns = _columns()
    if "category_kind" not in columns:
        op.add_column(_TABLE, sa.Column("category_kind", sa.String(length=32), nullable=True))
    if "part_inspection_id" not in columns:
        op.add_column(_TABLE, sa.Column("part_inspection_id", sa.String(), nullable=True))
    if _INDEX not in _indexes():
        op.create_index(_INDEX, _TABLE, ["part_inspection_id"])


def downgrade() -> None:
    if _INDEX in _indexes():
        op.drop_index(_INDEX, table_name=_TABLE)
    columns = _columns()
    if "part_inspection_id" in columns:
        op.drop_column(_TABLE, "part_inspection_id")
    if "category_kind" in columns:
        op.drop_column(_TABLE, "category_kind")
