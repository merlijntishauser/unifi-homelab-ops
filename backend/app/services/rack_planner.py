"""Rack planner service for managing racks and rack items."""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.database import get_session
from app.models import BomEntry, BomResponse, Rack, RackItem, RackSummary
from app.models_db import RackItemRow, RackRow

if TYPE_CHECKING:
    from app.config import UnifiCredentials
    from app.models import RackInput, RackItemInput

log = structlog.get_logger()

_DEVICE_TYPE_MAP: dict[str, str] = {
    "gateway": "gateway",
    "udm": "gateway",
    "ugw": "gateway",
    "switch": "switch",
    "usw": "switch",
    "ap": "ap",
    "uap": "ap",
}

_NON_RACKMOUNT_TYPES = {"ap"}


def _row_to_rack_item(row: RackItemRow) -> RackItem:
    """Convert a RackItemRow to a RackItem model."""
    return RackItem(
        id=row.id,
        position_u=row.position_u,
        height_u=row.height_u,
        device_type=row.device_type,
        label=row.label,
        power_watts=row.power_watts,
        device_mac=row.device_mac,
        notes=row.notes,
    )


def _build_rack(rack_row: RackRow, item_rows: list[RackItemRow]) -> Rack:
    """Build a Rack model from a RackRow and its items."""
    items = [_row_to_rack_item(r) for r in item_rows]
    total_power = sum(i.power_watts for i in items)
    used_u = sum(i.height_u for i in items)
    return Rack(
        id=rack_row.id,
        name=rack_row.name,
        size=rack_row.size,
        height_u=rack_row.height_u,
        location=rack_row.location,
        items=items,
        total_power=total_power,
        used_u=used_u,
    )


def _get_rack_row_or_raise(rack_id: int) -> RackRow:
    """Fetch a RackRow by ID or raise ValueError."""
    session = get_session()
    try:
        row = session.get(RackRow, rack_id)
        if row is None:
            msg = f"Rack {rack_id} not found"
            raise ValueError(msg)
        # Detach from session so it can be used after close
        session.expunge(row)
        return row
    finally:
        session.close()


def _get_items_for_rack(rack_id: int) -> list[RackItemRow]:
    """Fetch all RackItemRows for a given rack."""
    session = get_session()
    try:
        rows = session.query(RackItemRow).filter(RackItemRow.rack_id == rack_id).all()
        for r in rows:
            session.expunge(r)
        return rows
    finally:
        session.close()


def _check_overlap(
    rack_id: int, position_u: int, height_u: int, rack_height: int, exclude_item_id: int | None = None,
) -> None:
    """Validate that the item fits in the rack and does not overlap existing items."""
    if position_u < 1:
        msg = f"Position must be >= 1, got {position_u}"
        raise ValueError(msg)
    if height_u < 1:
        msg = f"Height must be >= 1, got {height_u}"
        raise ValueError(msg)
    top_u = position_u + height_u - 1
    if top_u > rack_height:
        msg = f"Item at position {position_u} with height {height_u}U exceeds rack height {rack_height}U"
        raise ValueError(msg)

    existing = _get_items_for_rack(rack_id)
    for item in existing:
        if exclude_item_id is not None and item.id == exclude_item_id:
            continue
        item_top = item.position_u + item.height_u - 1
        if position_u <= item_top and top_u >= item.position_u:
            msg = f"Position {position_u}-{top_u}U overlaps with '{item.label}' at {item.position_u}-{item_top}U"
            raise ValueError(msg)


def list_racks() -> list[RackSummary]:
    """List all racks with summary stats."""
    session = get_session()
    try:
        rack_rows = session.query(RackRow).all()
        summaries: list[RackSummary] = []
        for rack_row in rack_rows:
            item_rows = session.query(RackItemRow).filter(RackItemRow.rack_id == rack_row.id).all()
            total_power = sum(r.power_watts for r in item_rows)
            used_u = sum(r.height_u for r in item_rows)
            summaries.append(RackSummary(
                id=rack_row.id,
                name=rack_row.name,
                size=rack_row.size,
                height_u=rack_row.height_u,
                location=rack_row.location,
                item_count=len(item_rows),
                used_u=used_u,
                total_power=total_power,
            ))
        log.debug("racks_listed", count=len(summaries))
        return summaries
    finally:
        session.close()


def get_rack(rack_id: int) -> Rack:
    """Get a rack with all items, optionally enriched with live device data."""
    rack_row = _get_rack_row_or_raise(rack_id)
    item_rows = _get_items_for_rack(rack_id)
    rack = _build_rack(rack_row, item_rows)
    log.debug("rack_fetched", rack_id=rack_id, item_count=len(rack.items))
    return rack


def create_rack(data: RackInput) -> Rack:
    """Create a new rack."""
    session = get_session()
    try:
        row = RackRow(
            name=data.name,
            size=data.size,
            height_u=data.height_u,
            location=data.location,
        )
        session.add(row)
        session.commit()
        rack_id = row.id
        session.expunge(row)
        log.info("rack_created", rack_id=rack_id, name=data.name)
    finally:
        session.close()
    return get_rack(rack_id)


def update_rack(rack_id: int, data: RackInput) -> Rack:
    """Update rack metadata."""
    session = get_session()
    try:
        row = session.get(RackRow, rack_id)
        if row is None:
            msg = f"Rack {rack_id} not found"
            raise ValueError(msg)
        # If height is being reduced, check that existing items still fit
        if data.height_u < row.height_u:
            items = session.query(RackItemRow).filter(RackItemRow.rack_id == rack_id).all()
            for item in items:
                top_u = item.position_u + item.height_u - 1
                if top_u > data.height_u:
                    msg = f"Cannot reduce height to {data.height_u}U: item '{item.label}' extends to {top_u}U"
                    raise ValueError(msg)
        row.name = data.name
        row.size = data.size
        row.height_u = data.height_u
        row.location = data.location
        session.commit()
        log.info("rack_updated", rack_id=rack_id)
    finally:
        session.close()
    return get_rack(rack_id)


def delete_rack(rack_id: int) -> None:
    """Delete a rack and all its items."""
    session = get_session()
    try:
        row = session.get(RackRow, rack_id)
        if row is None:
            msg = f"Rack {rack_id} not found"
            raise ValueError(msg)
        # Delete items first (CASCADE may not be enforced in all SQLite configs)
        session.query(RackItemRow).filter(RackItemRow.rack_id == rack_id).delete()
        session.delete(row)
        session.commit()
        log.info("rack_deleted", rack_id=rack_id)
    finally:
        session.close()


def add_rack_item(rack_id: int, data: RackItemInput) -> RackItem:
    """Add an item to a rack."""
    rack_row = _get_rack_row_or_raise(rack_id)
    _check_overlap(rack_id, data.position_u, data.height_u, rack_row.height_u)
    session = get_session()
    try:
        row = RackItemRow(
            rack_id=rack_id,
            position_u=data.position_u,
            height_u=data.height_u,
            device_type=data.device_type,
            label=data.label,
            power_watts=data.power_watts,
            device_mac=data.device_mac,
            notes=data.notes,
        )
        session.add(row)
        session.commit()
        result = _row_to_rack_item(row)
        session.expunge(row)
        log.info("rack_item_added", rack_id=rack_id, item_id=row.id, label=data.label)
        return result
    finally:
        session.close()


def update_rack_item(rack_id: int, item_id: int, data: RackItemInput) -> RackItem:
    """Update a rack item."""
    rack_row = _get_rack_row_or_raise(rack_id)
    _check_overlap(rack_id, data.position_u, data.height_u, rack_row.height_u, exclude_item_id=item_id)
    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None or row.rack_id != rack_id:
            msg = f"Item {item_id} not found in rack {rack_id}"
            raise ValueError(msg)
        row.position_u = data.position_u
        row.height_u = data.height_u
        row.device_type = data.device_type
        row.label = data.label
        row.power_watts = data.power_watts
        row.device_mac = data.device_mac
        row.notes = data.notes
        session.commit()
        result = _row_to_rack_item(row)
        session.expunge(row)
        log.info("rack_item_updated", rack_id=rack_id, item_id=item_id)
        return result
    finally:
        session.close()


def delete_rack_item(rack_id: int, item_id: int) -> None:
    """Delete a rack item."""
    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None or row.rack_id != rack_id:
            msg = f"Item {item_id} not found in rack {rack_id}"
            raise ValueError(msg)
        session.delete(row)
        session.commit()
        log.info("rack_item_deleted", rack_id=rack_id, item_id=item_id)
    finally:
        session.close()


def move_rack_item(rack_id: int, item_id: int, new_position_u: int) -> RackItem:
    """Move a rack item to a new position."""
    rack_row = _get_rack_row_or_raise(rack_id)
    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None or row.rack_id != rack_id:
            msg = f"Item {item_id} not found in rack {rack_id}"
            raise ValueError(msg)
        height_u = row.height_u
        session.expunge(row)
    finally:
        session.close()

    _check_overlap(rack_id, new_position_u, height_u, rack_row.height_u, exclude_item_id=item_id)

    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None:
            msg = f"Item {item_id} not found"
            raise ValueError(msg)
        row.position_u = new_position_u
        session.commit()
        result = _row_to_rack_item(row)
        session.expunge(row)
        log.info("rack_item_moved", rack_id=rack_id, item_id=item_id, new_position=new_position_u)
        return result
    finally:
        session.close()


def get_bom(rack_id: int) -> BomResponse:
    """Generate a bill of materials for a rack."""
    rack_row = _get_rack_row_or_raise(rack_id)
    item_rows = _get_items_for_rack(rack_id)

    entries: list[BomEntry] = []

    # List all devices currently in the rack
    for item in item_rows:
        entries.append(BomEntry(
            item_type="device",
            label=item.label,
            quantity=1,
            notes=f"{item.height_u}U, {item.power_watts}W" if item.power_watts > 0 else f"{item.height_u}U",
        ))

    # Calculate empty U slots and suggest blanking plates
    used_slots: set[int] = set()
    for item in item_rows:
        for u in range(item.position_u, item.position_u + item.height_u):
            used_slots.add(u)
    empty_u = rack_row.height_u - len(used_slots)
    if empty_u > 0:
        entries.append(BomEntry(
            item_type="blanking-plate",
            label="1U blanking plate",
            quantity=empty_u,
            notes="Cover empty rack slots",
        ))

    # Suggest shelves for non-rackmount devices
    shelf_count = sum(1 for item in item_rows if item.device_type in _NON_RACKMOUNT_TYPES)
    if shelf_count > 0:
        entries.append(BomEntry(
            item_type="suggestion",
            label=f"{rack_row.size} rack shelf",
            quantity=shelf_count,
            notes="For non-rackmount devices (APs)",
        ))

    log.debug("bom_generated", rack_id=rack_id, entry_count=len(entries))
    return BomResponse(rack_name=rack_row.name, entries=entries)


def import_from_topology(rack_id: int, credentials: UnifiCredentials) -> list[RackItem]:
    """Auto-populate rack items from topology devices."""
    from app.services.topology import get_topology_devices

    rack_row = _get_rack_row_or_raise(rack_id)
    existing_items = _get_items_for_rack(rack_id)

    topology = get_topology_devices(credentials)

    # Build set of MACs already in the rack
    existing_macs = {item.device_mac for item in existing_items if item.device_mac}

    # Find next available position (stack from bottom)
    used_slots: set[int] = set()
    for item in existing_items:
        for u in range(item.position_u, item.position_u + item.height_u):
            used_slots.add(u)

    imported: list[RackItem] = []
    for device in topology.devices:
        device_type = _DEVICE_TYPE_MAP.get(device.type, "other")
        if device_type == "other":
            continue
        if device.mac in existing_macs:
            continue

        # Find next free position
        position = _find_next_free_position(used_slots, 1, rack_row.height_u)
        if position is None:
            log.warning("rack_import_full", rack_id=rack_id, skipped_device=device.name)
            break

        notes = ""
        if device_type in _NON_RACKMOUNT_TYPES:
            notes = "shelf recommended"

        session = get_session()
        try:
            row = RackItemRow(
                rack_id=rack_id,
                position_u=position,
                height_u=1,
                device_type=device_type,
                label=device.name,
                power_watts=0.0,
                device_mac=device.mac,
                notes=notes,
            )
            session.add(row)
            session.commit()
            result = _row_to_rack_item(row)
            session.expunge(row)
            imported.append(result)
            used_slots.add(position)
        finally:
            session.close()

    log.info("rack_import_complete", rack_id=rack_id, imported_count=len(imported))
    return imported


def _find_next_free_position(used_slots: set[int], height_u: int, rack_height: int) -> int | None:
    """Find the lowest available position for an item of given height."""
    for pos in range(1, rack_height - height_u + 2):
        if all((pos + offset) not in used_slots for offset in range(height_u)):
            return pos
    return None
