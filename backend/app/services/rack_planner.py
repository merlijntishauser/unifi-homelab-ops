"""Rack planner service for managing racks and rack items."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog

from app.database import get_session
from app.models import BomEntry, BomResponse, DeviceSpec, Rack, RackItem, RackSummary
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


_VALID_WIDTH_FRACTIONS = {0.25, 0.5, 1.0}
_VALID_POSITION_X = {0.0, 0.25, 0.5, 0.75}


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
        width_fraction=row.width_fraction,
        position_x=row.position_x,
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


def _validate_width_and_position_x(width_fraction: float, position_x: float) -> None:
    """Validate width_fraction and position_x values."""
    if width_fraction not in _VALID_WIDTH_FRACTIONS:
        msg = f"width_fraction must be one of {sorted(_VALID_WIDTH_FRACTIONS)}, got {width_fraction}"
        raise ValueError(msg)
    if position_x not in _VALID_POSITION_X:
        msg = f"position_x must be one of {sorted(_VALID_POSITION_X)}, got {position_x}"
        raise ValueError(msg)
    if position_x + width_fraction > 1.0:
        msg = f"position_x ({position_x}) + width_fraction ({width_fraction}) exceeds rack width"
        raise ValueError(msg)


def _check_overlap(
    rack_id: int,
    position_u: float,
    height_u: float,
    rack_height: int,
    width_fraction: float = 1.0,
    position_x: float = 0.0,
    exclude_item_id: int | None = None,
) -> None:
    """Validate that the item fits in the rack and does not overlap existing items."""
    _validate_width_and_position_x(width_fraction, position_x)
    if height_u < 0:
        msg = f"Height must be >= 0, got {height_u}"
        raise ValueError(msg)
    if height_u > 0 and height_u % 0.5 != 0:
        msg = f"Height must be a multiple of 0.5, got {height_u}"
        raise ValueError(msg)

    # 0U items mount on side rails -- skip position and overlap checks
    if height_u == 0:
        return

    if position_u < 1 or position_u % 0.5 != 0:
        msg = f"Position must be >= 1 and a multiple of 0.5, got {position_u}"
        raise ValueError(msg)
    item_end = position_u + height_u
    if item_end - 1 > rack_height:
        msg = f"Item at position {position_u} with height {height_u}U exceeds rack height {rack_height}U"
        raise ValueError(msg)

    existing = _get_items_for_rack(rack_id)
    x_right = position_x + width_fraction
    for item in existing:
        if exclude_item_id is not None and item.id == exclude_item_id:
            continue
        # Skip 0U items -- they don't occupy rack unit space
        if item.height_u == 0:
            continue
        existing_end = item.position_u + item.height_u
        vertical_overlap = position_u < existing_end and item_end > item.position_u
        if not vertical_overlap:
            continue
        item_x_right = item.position_x + item.width_fraction
        horizontal_overlap = position_x < item_x_right and x_right > item.position_x
        if horizontal_overlap:
            msg = (
                f"Position {position_u}-{item_end - 1}U overlaps with "
                f"'{item.label}' at {item.position_u}-{existing_end - 1}U"
            )
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


def _find_free_position(
    rack_id: int, height_u: float, rack_height: int,
    width_fraction: float, position_x: float, preferred_u: float,
) -> float:
    """Find a free position, trying preferred_u first then scanning from bottom."""
    if height_u == 0:
        return preferred_u
    try:
        _check_overlap(rack_id, preferred_u, height_u, rack_height, width_fraction, position_x)
        return preferred_u
    except ValueError:
        pass
    # Scan from bottom in 0.5U steps
    u = 1.0
    while u + height_u - 0.5 <= rack_height:
        try:
            _check_overlap(rack_id, u, height_u, rack_height, width_fraction, position_x)
            return u
        except ValueError:
            u += 0.5
    msg = f"No free position for a {height_u}U item in this rack"
    raise ValueError(msg)


def add_rack_item(rack_id: int, data: RackItemInput) -> RackItem:
    """Add an item to a rack, auto-finding a free position if the requested one is occupied."""
    rack_row = _get_rack_row_or_raise(rack_id)
    _validate_width_and_position_x(data.width_fraction, data.position_x)
    position_u = _find_free_position(
        rack_id, data.height_u, rack_row.height_u,
        data.width_fraction, data.position_x, data.position_u,
    )
    session = get_session()
    try:
        row = RackItemRow(
            rack_id=rack_id,
            position_u=position_u,
            height_u=data.height_u,
            device_type=data.device_type,
            label=data.label,
            power_watts=data.power_watts,
            device_mac=data.device_mac,
            notes=data.notes,
            width_fraction=data.width_fraction,
            position_x=data.position_x,
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
    _check_overlap(
        rack_id, data.position_u, data.height_u, rack_row.height_u,
        width_fraction=data.width_fraction, position_x=data.position_x, exclude_item_id=item_id,
    )
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
        row.width_fraction = data.width_fraction
        row.position_x = data.position_x
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


def move_rack_item(rack_id: int, item_id: int, new_position_u: float, new_position_x: float = 0.0) -> RackItem:
    """Move a rack item to a new position."""
    rack_row = _get_rack_row_or_raise(rack_id)
    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None or row.rack_id != rack_id:
            msg = f"Item {item_id} not found in rack {rack_id}"
            raise ValueError(msg)
        height_u = row.height_u
        width_fraction = row.width_fraction
        session.expunge(row)
    finally:
        session.close()

    _check_overlap(
        rack_id, new_position_u, height_u, rack_row.height_u,
        width_fraction=width_fraction, position_x=new_position_x, exclude_item_id=item_id,
    )

    session = get_session()
    try:
        row = session.get(RackItemRow, item_id)
        if row is None:
            msg = f"Item {item_id} not found"
            raise ValueError(msg)
        row.position_u = new_position_u
        row.position_x = new_position_x
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
            notes=f"{item.height_u:g}U, {item.power_watts}W" if item.power_watts > 0 else f"{item.height_u:g}U",
        ))

    # Calculate empty U slots and suggest blanking plates
    used_half_slots: set[float] = set()
    for item in item_rows:
        s = float(item.position_u)
        while s < item.position_u + item.height_u:
            used_half_slots.add(s)
            s += 0.5
    total_half_slots = rack_row.height_u * 2
    empty_u = (total_half_slots - len(used_half_slots)) // 2
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


def get_available_devices(rack_id: int, credentials: UnifiCredentials) -> list[dict[str, str]]:
    """List topology devices not yet placed in this rack."""
    from app.services.topology import get_topology_devices

    _get_rack_row_or_raise(rack_id)
    existing_items = _get_items_for_rack(rack_id)
    existing_macs = {item.device_mac for item in existing_items if item.device_mac}

    topology = get_topology_devices(credentials)
    devices: list[dict[str, str]] = []
    for device in topology.devices:
        if device.mac in existing_macs:
            continue
        device_type = _DEVICE_TYPE_MAP.get(device.type, "other")
        devices.append({
            "mac": device.mac,
            "name": device.name,
            "model": device.model_name or device.model,
            "type": device_type,
        })
    return devices


def import_from_topology(rack_id: int, credentials: UnifiCredentials) -> list[RackItem]:
    """Auto-populate rack items from topology devices, enriched with physical specs."""
    from unifi_topology import lookup_model_specs

    from app.services.topology import get_topology_devices

    rack_row = _get_rack_row_or_raise(rack_id)
    existing_items = _get_items_for_rack(rack_id)

    topology = get_topology_devices(credentials)

    # Build set of MACs already in the rack
    existing_macs = {item.device_mac for item in existing_items if item.device_mac}

    imported: list[RackItem] = []
    for device in topology.devices:
        device_type = _DEVICE_TYPE_MAP.get(device.type, "other")
        if device_type == "other":
            continue
        if device.mac in existing_macs:
            continue

        # Enrich with physical specs from library
        model_key = device.model or device.model_name or ""
        specs = lookup_model_specs(model_key) if model_key else {}
        height_u = float(specs.get("rack_height_u", 1))
        power_watts = specs.get("max_power_w", 0.0) or 0.0
        dims = specs.get("dimensions_mm", {})
        form_factor = specs.get("form_factor", "")
        width_fraction = _derive_width_fraction(dims, form_factor) if dims else 1.0

        # Find next free position using the same logic as add_rack_item
        try:
            position = _find_free_position(
                rack_id, height_u, rack_row.height_u, width_fraction, 0.0, 1.0,
            )
        except ValueError:
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
                height_u=height_u,
                device_type=device_type,
                label=device.name,
                power_watts=power_watts,
                device_mac=device.mac,
                notes=notes,
                width_fraction=width_fraction,
            )
            session.add(row)
            session.commit()
            result = _row_to_rack_item(row)
            session.expunge(row)
            imported.append(result)
        finally:
            session.close()

    log.info("rack_import_complete", rack_id=rack_id, imported_count=len(imported))
    return imported



# ── Device spec catalog ──

_MODEL_PREFIX_TYPE_MAP: dict[str, str] = {
    "UCG": "gateway", "UDM": "gateway", "UDR": "gateway", "UXG": "gateway", "EFG": "gateway",
    "USW": "switch", "USL": "switch", "USP": "switch", "US6": "switch", "US1": "switch",
    "US2": "switch", "US4": "switch", "USA": "switch", "USF": "switch", "USX": "switch",
    "USM": "switch", "ECS": "switch",
    "UNV": "other", "UNA": "other", "CK": "other",
}

# Standard 19" rack devices are ~442mm wide, 10" rack devices are ~254mm
_WIDTH_19_INCH_MM = 400.0
_WIDTH_10_INCH_MM = 220.0

def _passive(
    model: str, name: str, dtype: str, height: float, width: float, form: str,
) -> dict[str, Any]:
    return {
        "model": model, "name": name, "type": dtype,
        "height_u": height, "width_fraction": width, "form_factor": form,
    }


_PASSIVE_ITEMS: list[dict[str, Any]] = [
    _passive("Patch-24", "Patch Panel 24-Port", "patch-panel", 1, 1.0, '19" rackmount'),
    _passive("Patch-48", "Patch Panel 48-Port", "patch-panel", 2, 1.0, '19" rackmount'),
    _passive("Patch-12-10", 'Patch Panel 12-Port 10"', "patch-panel", 0.5, 1.0, '10" rackmount'),
    _passive("Brush-Panel", "Brush Cable Management", "other", 1, 1.0, '19" rackmount'),
    _passive("Blank-1U", "Blanking Panel 1U", "other", 1, 1.0, '19" rackmount'),
    _passive("Blank-0.5U", "Blanking Panel 0.5U", "other", 0.5, 1.0, '10"/19" rackmount'),
    _passive("Shelf-1U", "Rack Shelf 1U", "shelf", 1, 1.0, '19" rackmount'),
]


def _infer_device_type(model: str) -> str:
    """Infer device type from model prefix."""
    for prefix, dtype in _MODEL_PREFIX_TYPE_MAP.items():
        if model.upper().startswith(prefix):
            return dtype
    return "other"


def _derive_width_fraction(dims: dict[str, float], form_factor: str) -> float:
    """Derive rack width fraction from physical dimensions."""
    width = dims.get("width", 0.0)
    if width <= 0:
        # Circular devices (APs) or no width data
        return 0.25
    if width >= _WIDTH_19_INCH_MM:
        return 1.0
    if width >= _WIDTH_10_INCH_MM:
        return 0.5
    return 0.25


def get_device_specs() -> list[DeviceSpec]:
    """Get device specs catalog from unifi-topology library plus passive infrastructure."""
    from unifi_topology import list_all_models, lookup_model_specs, lookup_model_url

    models = list_all_models()
    specs: list[DeviceSpec] = []

    for model_code, entry in models.items():
        model_specs = lookup_model_specs(model_code)
        if not model_specs:
            continue
        rack_height = model_specs.get("rack_height_u")
        if rack_height is None:
            continue

        dims = model_specs.get("dimensions_mm", {})
        form_factor = model_specs.get("form_factor", "")
        device_type = _infer_device_type(model_code)

        specs.append(DeviceSpec(
            model=model_code,
            name=entry.get("name", model_code),
            type=device_type,
            height_u=float(rack_height),
            width_fraction=_derive_width_fraction(dims, form_factor),
            form_factor=form_factor,
            max_power_w=model_specs.get("max_power_w"),
            weight_kg=model_specs.get("weight_kg"),
            product_url=lookup_model_url(model_code),
        ))

    # Add passive infrastructure items
    for item in _PASSIVE_ITEMS:
        specs.append(DeviceSpec(
            model=item["model"],
            name=item["name"],
            type=item["type"],
            height_u=item["height_u"],
            width_fraction=item["width_fraction"],
            form_factor=item["form_factor"],
        ))

    # Sort: rackmount devices first, then by name
    specs.sort(key=lambda s: (s.type == "shelf", s.type == "other" and s.model.startswith(("Blank", "Brush")), s.name))
    log.debug("device_specs_loaded", count=len(specs))
    return specs
