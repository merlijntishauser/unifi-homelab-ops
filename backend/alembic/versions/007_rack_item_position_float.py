"""Change rack_items.position_u from INTEGER to REAL for 0.5U positioning.

Revision ID: 007
Revises: 006
Create Date: 2026-03-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("rack_items") as batch_op:
        batch_op.alter_column("position_u", type_=sa.Float, existing_type=sa.Integer)


def downgrade() -> None:
    with op.batch_alter_table("rack_items") as batch_op:
        batch_op.alter_column("position_u", type_=sa.Integer, existing_type=sa.Float)
