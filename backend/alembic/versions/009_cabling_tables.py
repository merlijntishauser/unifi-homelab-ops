"""Add cabling module tables.

Revision ID: 009
Revises: 008
Create Date: 2026-03-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS patch_panels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            port_count INTEGER NOT NULL DEFAULT 24,
            panel_type TEXT NOT NULL DEFAULT 'keystone',
            rack_mounted INTEGER NOT NULL DEFAULT 0,
            rack_item_id INTEGER REFERENCES rack_items(id) ON DELETE SET NULL,
            location TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT ''
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS cable_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_device_mac TEXT,
            source_port INTEGER,
            dest_device_mac TEXT,
            dest_port INTEGER,
            dest_label TEXT NOT NULL DEFAULT '',
            patch_panel_id INTEGER REFERENCES patch_panels(id) ON DELETE SET NULL,
            patch_panel_port INTEGER,
            cable_type TEXT NOT NULL DEFAULT 'cat6',
            length_m REAL,
            color TEXT NOT NULL DEFAULT '',
            label TEXT NOT NULL DEFAULT '',
            speed INTEGER,
            poe INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            notes TEXT NOT NULL DEFAULT ''
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS cable_label_settings (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            mode TEXT NOT NULL DEFAULT 'sequential',
            prefix TEXT NOT NULL DEFAULT 'C-',
            next_number INTEGER NOT NULL DEFAULT 1,
            custom_pattern TEXT
        )
    """)


def downgrade() -> None:
    op.drop_table("cable_label_settings")
    op.drop_table("cable_runs")
    op.drop_table("patch_panels")
