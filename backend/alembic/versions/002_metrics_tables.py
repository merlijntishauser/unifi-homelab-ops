"""Add metrics and notification tables.

Revision ID: 002
Revises: 001
Create Date: 2026-03-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS device_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mac TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            cpu REAL NOT NULL,
            mem REAL NOT NULL,
            temperature REAL,
            uptime INTEGER NOT NULL,
            tx_bytes INTEGER NOT NULL,
            rx_bytes INTEGER NOT NULL,
            num_sta INTEGER NOT NULL,
            poe_consumption REAL
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_device_metrics_mac_timestamp
        ON device_metrics (mac, timestamp)
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_mac TEXT NOT NULL,
            check_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            dismissed INTEGER NOT NULL DEFAULT 0
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_notifications_active
        ON notifications (resolved_at, dismissed)
    """)


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("device_metrics")
