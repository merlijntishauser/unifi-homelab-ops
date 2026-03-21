"""Add topology node positions table.

Revision ID: 008
Revises: 007
Create Date: 2026-03-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "topology_node_positions",
        sa.Column("mac", sa.Text, primary_key=True),
        sa.Column("x", sa.Float, nullable=False),
        sa.Column("y", sa.Float, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("topology_node_positions")
