"""Zone filter persistence service."""

from __future__ import annotations

import structlog
from sqlalchemy import select

from app.database import get_session
from app.models_db import HiddenZoneRow

log = structlog.get_logger()


def get_hidden_zone_ids() -> list[str]:
    """Return all hidden zone IDs."""
    session = get_session()
    try:
        rows = session.execute(select(HiddenZoneRow.zone_id)).scalars().all()
        log.debug("hidden_zones_loaded", count=len(rows))
        return list(rows)
    finally:
        session.close()


def save_hidden_zone_ids(zone_ids: list[str]) -> None:
    """Replace hidden zone IDs with the given list (duplicates are ignored)."""
    unique_ids = list(dict.fromkeys(zone_ids))  # deduplicate, preserve order
    log.info("hidden_zones_save", count=len(unique_ids), zone_ids=unique_ids)
    session = get_session()
    try:
        session.query(HiddenZoneRow).delete()
        for zid in unique_ids:
            session.add(HiddenZoneRow(zone_id=zid))
        session.commit()
    finally:
        session.close()
