"""link operators to login users (operator-as-user auth, ADR-018)

Operators become login accounts (role `operator`) instead of name+PIN on a
shared station token. We keep the `operators` table for attribution
(`inspection_logs.operator_id` and all stats stay intact) and add a nullable
link to the owning `users` row.

Idempotent: guards on the live schema so `alembic upgrade head` self-heals.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "operators"
_INDEX = "ix_operators_user_id"


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(_TABLE)}


def _indexes() -> set[str]:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(_TABLE)}


def upgrade() -> None:
    if "user_id" not in _columns():
        op.add_column(_TABLE, sa.Column("user_id", sa.Integer(), nullable=True))
    if _INDEX not in _indexes():
        # Unique so one user maps to at most one operator (SQLite allows
        # multiple NULLs, so unlinked operators are fine).
        op.create_index(_INDEX, _TABLE, ["user_id"], unique=True)


def downgrade() -> None:
    if _INDEX in _indexes():
        op.drop_index(_INDEX, table_name=_TABLE)
    if "user_id" in _columns():
        op.drop_column(_TABLE, "user_id")
