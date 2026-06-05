"""add a friendly device name (web stations / andon board)

Web tablets get a stable per-device id; this column holds the human label shown
in "Stations en direct" (browsers can't read the OS device name, so the device
reports one). Idempotent.

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "devices"


def _columns() -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(_TABLE)}


def upgrade() -> None:
    if "name" not in _columns():
        op.add_column(_TABLE, sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    if "name" in _columns():
        op.drop_column(_TABLE, "name")
