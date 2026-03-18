"""Change rack_items.height_u from INTEGER to REAL for 0.5U support.

Revision ID: 006
Revises: 005
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("rack_items") as batch_op:
        batch_op.alter_column("height_u", type_=sa.Float, existing_type=sa.Integer)


def downgrade() -> None:
    with op.batch_alter_table("rack_items") as batch_op:
        batch_op.alter_column("height_u", type_=sa.Integer, existing_type=sa.Float)
