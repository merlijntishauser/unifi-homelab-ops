"""Add rack planner tables.

Revision ID: 004
Revises: 003
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS racks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            size TEXT NOT NULL DEFAULT '19-inch',
            height_u INTEGER NOT NULL DEFAULT 12,
            location TEXT NOT NULL DEFAULT ''
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS rack_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rack_id INTEGER NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
            position_u INTEGER NOT NULL,
            height_u INTEGER NOT NULL DEFAULT 1,
            device_type TEXT NOT NULL DEFAULT 'other',
            label TEXT NOT NULL,
            power_watts REAL NOT NULL DEFAULT 0.0,
            device_mac TEXT,
            notes TEXT NOT NULL DEFAULT ''
        )
    """)


def downgrade() -> None:
    op.drop_table("rack_items")
    op.drop_table("racks")
