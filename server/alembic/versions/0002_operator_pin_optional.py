"""make operator pin_hash nullable

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-16

Operators can now be created without a PIN. A PIN is set separately via
POST /operators/{id}/pin. Operators without a PIN are excluded from the
STM32 operator-list publish.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("operators") as batch_op:
        batch_op.alter_column("pin_hash", nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("operators") as batch_op:
        batch_op.alter_column("pin_hash", nullable=False)
