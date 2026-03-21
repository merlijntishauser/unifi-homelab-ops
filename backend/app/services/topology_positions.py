"""Topology node position persistence service."""

from __future__ import annotations

import structlog

from app.database import get_session
from app.models import NodePosition
from app.models_db import TopologyNodePositionRow

log = structlog.get_logger()


def get_node_positions() -> list[NodePosition]:
    """Return all saved node positions."""
    session = get_session()
    try:
        rows = session.query(TopologyNodePositionRow).all()
        return [NodePosition(mac=r.mac, x=r.x, y=r.y) for r in rows]
    finally:
        session.close()


def save_node_positions(positions: list[NodePosition]) -> None:
    """Upsert node positions (insert or update by MAC)."""
    session = get_session()
    try:
        for pos in positions:
            session.merge(TopologyNodePositionRow(mac=pos.mac, x=pos.x, y=pos.y))
        session.commit()
        log.debug("node_positions_saved", count=len(positions))
    finally:
        session.close()


def delete_all_positions() -> None:
    """Delete all saved node positions."""
    session = get_session()
    try:
        session.query(TopologyNodePositionRow).delete()
        session.commit()
        log.info("node_positions_cleared")
    finally:
        session.close()
