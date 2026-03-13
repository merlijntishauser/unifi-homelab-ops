"""Zone filter persistence service."""

from __future__ import annotations

import logging
from pathlib import Path

from app.database import get_connection

logger = logging.getLogger(__name__)


def get_hidden_zone_ids(db_path: Path) -> list[str]:
    """Return all hidden zone IDs."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute("SELECT zone_id FROM hidden_zones").fetchall()
        result = [row[0] for row in rows]
        logger.debug("Loaded %d hidden zone IDs", len(result))
        return result
    finally:
        conn.close()


def save_hidden_zone_ids(db_path: Path, zone_ids: list[str]) -> None:
    """Replace hidden zone IDs with the given list."""
    logger.debug("Saving %d hidden zone IDs: %s", len(zone_ids), zone_ids)
    conn = get_connection(db_path)
    try:
        conn.execute("DELETE FROM hidden_zones")
        if zone_ids:
            conn.executemany(
                "INSERT INTO hidden_zones (zone_id) VALUES (?)",
                [(zid,) for zid in zone_ids],
            )
        conn.commit()
    finally:
        conn.close()
