"""operator details: matricule (login id) + last name, phone, address

Operators gain HR-style details. The matricule is the operator's login username
(ADR-018 made operators login accounts); these columns hold the rest of the
profile. Idempotent.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "operators"
_INDEX = "ix_operators_matricule"
_COLS = {
    "matricule": sa.String(length=32),
    "last_name": sa.String(length=64),
    "phone": sa.String(length=32),
    "address": sa.String(length=255),
}


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(_TABLE)}


def _indexes() -> set[str]:
    return {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(_TABLE)}


def upgrade() -> None:
    existing = _columns()
    for name, type_ in _COLS.items():
        if name not in existing:
            op.add_column(_TABLE, sa.Column(name, type_, nullable=True))
    if _INDEX not in _indexes():
        op.create_index(_INDEX, _TABLE, ["matricule"], unique=True)


def downgrade() -> None:
    if _INDEX in _indexes():
        op.drop_index(_INDEX, table_name=_TABLE)
    existing = _columns()
    for name in _COLS:
        if name in existing:
            op.drop_column(_TABLE, name)
