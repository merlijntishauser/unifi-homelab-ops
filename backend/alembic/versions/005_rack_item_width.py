"""Add width_fraction and position_x columns to rack_items.

Revision ID: 005
Revises: 004
Create Date: 2026-03-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE rack_items ADD COLUMN width_fraction REAL NOT NULL DEFAULT 1.0")
    op.execute("ALTER TABLE rack_items ADD COLUMN position_x REAL NOT NULL DEFAULT 0.0")


def downgrade() -> None:
    # SQLite does not support DROP COLUMN before 3.35; recreate table without the columns
    op.execute("""
        CREATE TABLE rack_items_backup (
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
    op.execute("""
        INSERT INTO rack_items_backup
            (id, rack_id, position_u, height_u, device_type, label, power_watts, device_mac, notes)
        SELECT id, rack_id, position_u, height_u, device_type, label, power_watts, device_mac, notes
        FROM rack_items
    """)
    op.execute("DROP TABLE rack_items")
    op.execute("ALTER TABLE rack_items_backup RENAME TO rack_items")
