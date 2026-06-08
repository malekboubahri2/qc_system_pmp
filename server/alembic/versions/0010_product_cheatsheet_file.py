"""product cheatsheet file: stored filename, mime, original name

Products gain an optional uploaded cheatsheet document (PDF/image) that the
responsable attaches and inspectors browse in the PWA. Only the file metadata
lives in the DB; the bytes are stored under settings.upload_dir. Idempotent.

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "products"
_COLS = {
    "cheatsheet_file": sa.String(),
    "cheatsheet_mime": sa.String(),
    "cheatsheet_name": sa.String(),
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
