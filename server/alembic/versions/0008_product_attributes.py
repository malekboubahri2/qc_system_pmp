"""product attributes: reference, client, cheatsheet

Products gain a reference, a client, and a free-text cheatsheet (inspection
notes / instructions) so the dashboard shows more than a name. Idempotent.

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "products"
_COLS = {
    "reference": sa.String(length=64),
    "client": sa.String(length=120),
    "cheatsheet": sa.String(),
}


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(_TABLE)}


def upgrade() -> None:
    existing = _columns()
    for name, type_ in _COLS.items():
        if name not in existing:
            op.add_column(_TABLE, sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    existing = _columns()
    for name in _COLS:
        if name in existing:
            op.drop_column(_TABLE, name)
