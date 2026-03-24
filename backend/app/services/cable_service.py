"""Cable management service for tracking physical cable runs and patch panels."""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.database import get_session
from app.models import CableLabelSettings, CableRun, PatchPanel
from app.models_db import CableLabelSettingsRow, CableRunRow, PatchPanelRow

if TYPE_CHECKING:
    from app.config import UnifiCredentials
    from app.models import CableRunInput, PatchPanelInput

log = structlog.get_logger()


def _row_to_cable(row: CableRunRow) -> CableRun:
    """Convert a CableRunRow to a CableRun model (without enrichment)."""
    return CableRun(
        id=row.id,
        source_device_mac=row.source_device_mac,
        source_port=row.source_port,
        dest_device_mac=row.dest_device_mac,
        dest_port=row.dest_port,
        dest_label=row.dest_label,
        patch_panel_id=row.patch_panel_id,
        patch_panel_port=row.patch_panel_port,
        cable_type=row.cable_type,
        length_m=row.length_m,
        color=row.color,
        label=row.label,
        speed=row.speed,
        poe=bool(row.poe),
        status=row.status,
        notes=row.notes,
    )


def _enrich_cable(cable: CableRun, device_names: dict[str, str], panel_names: dict[int, str]) -> CableRun:
    """Enrich a CableRun with device names and patch panel name."""
    if cable.source_device_mac:
        cable.source_device_name = device_names.get(cable.source_device_mac.lower())
    if cable.dest_device_mac:
        cable.dest_device_name = device_names.get(cable.dest_device_mac.lower())
    if cable.patch_panel_id is not None:
        cable.patch_panel_name = panel_names.get(cable.patch_panel_id)
    return cable


def _get_panel_names() -> dict[int, str]:
    """Build a mapping of panel ID -> panel name."""
    session = get_session()
    try:
        rows = session.query(PatchPanelRow).all()
        return {row.id: row.name for row in rows}
    finally:
        session.close()


def _row_to_panel(row: PatchPanelRow, assigned_ports: int = 0) -> PatchPanel:
    """Convert a PatchPanelRow to a PatchPanel model."""
    return PatchPanel(
        id=row.id,
        name=row.name,
        port_count=row.port_count,
        panel_type=row.panel_type,
        rack_mounted=bool(row.rack_mounted),
        rack_item_id=row.rack_item_id,
        location=row.location,
        notes=row.notes,
        assigned_ports=assigned_ports,
    )


def _generate_label() -> str:
    """Generate the next cable label from the label scheme and increment the counter."""
    session = get_session()
    try:
        row = session.get(CableLabelSettingsRow, 1)
        if row is None:
            row = CableLabelSettingsRow(id=1)
            session.add(row)
            session.flush()
        prefix = row.prefix
        number = row.next_number
        label = f"{prefix}{number:03d}"
        row.next_number = number + 1
        session.commit()
        session.expunge(row)
        return label
    finally:
        session.close()


def _count_assigned_ports(panel_id: int) -> int:
    """Count how many cables reference a given patch panel."""
    session = get_session()
    try:
        return session.query(CableRunRow).filter(CableRunRow.patch_panel_id == panel_id).count()
    finally:
        session.close()


# ── Cable CRUD ──


def list_cables(device_names: dict[str, str] | None = None) -> list[CableRun]:
    """List all cable runs, enriched with device and panel names."""
    session = get_session()
    try:
        rows = session.query(CableRunRow).all()
        for r in rows:
            session.expunge(r)
    finally:
        session.close()

    panel_names = _get_panel_names()
    names = device_names or {}
    cables = [_row_to_cable(r) for r in rows]
    for cable in cables:
        _enrich_cable(cable, names, panel_names)
    log.debug("cables_listed", count=len(cables))
    return cables


def get_cable(cable_id: int, device_names: dict[str, str] | None = None) -> CableRun:
    """Get a single cable run by ID."""
    session = get_session()
    try:
        row = session.get(CableRunRow, cable_id)
        if row is None:
            msg = f"Cable {cable_id} not found"
            raise ValueError(msg)
        session.expunge(row)
    finally:
        session.close()

    cable = _row_to_cable(row)
    panel_names = _get_panel_names()
    _enrich_cable(cable, device_names or {}, panel_names)
    return cable


def create_cable(data: CableRunInput) -> CableRun:
    """Create a new cable run, auto-generating a label if empty."""
    label = data.label if data.label else _generate_label()
    session = get_session()
    try:
        row = CableRunRow(
            source_device_mac=data.source_device_mac,
            source_port=data.source_port,
            dest_device_mac=data.dest_device_mac,
            dest_port=data.dest_port,
            dest_label=data.dest_label,
            patch_panel_id=data.patch_panel_id,
            patch_panel_port=data.patch_panel_port,
            cable_type=data.cable_type,
            length_m=data.length_m,
            color=data.color,
            label=label,
            speed=data.speed,
            poe=int(data.poe),
            status=data.status,
            notes=data.notes,
        )
        session.add(row)
        session.commit()
        cable_id = row.id
        session.expunge(row)
        log.info("cable_created", cable_id=cable_id, label=label)
    finally:
        session.close()
    return get_cable(cable_id)


def update_cable(cable_id: int, data: CableRunInput) -> CableRun:
    """Update an existing cable run."""
    session = get_session()
    try:
        row = session.get(CableRunRow, cable_id)
        if row is None:
            msg = f"Cable {cable_id} not found"
            raise ValueError(msg)
        row.source_device_mac = data.source_device_mac
        row.source_port = data.source_port
        row.dest_device_mac = data.dest_device_mac
        row.dest_port = data.dest_port
        row.dest_label = data.dest_label
        row.patch_panel_id = data.patch_panel_id
        row.patch_panel_port = data.patch_panel_port
        row.cable_type = data.cable_type
        row.length_m = data.length_m
        row.color = data.color
        row.label = data.label
        row.speed = data.speed
        row.poe = int(data.poe)
        row.status = data.status
        row.notes = data.notes
        session.commit()
        log.info("cable_updated", cable_id=cable_id)
    finally:
        session.close()
    return get_cable(cable_id)


def delete_cable(cable_id: int) -> None:
    """Delete a cable run."""
    session = get_session()
    try:
        row = session.get(CableRunRow, cable_id)
        if row is None:
            msg = f"Cable {cable_id} not found"
            raise ValueError(msg)
        session.delete(row)
        session.commit()
        log.info("cable_deleted", cable_id=cable_id)
    finally:
        session.close()


# ── Patch Panel CRUD ──


def list_patch_panels() -> list[PatchPanel]:
    """List all patch panels with assigned port counts."""
    session = get_session()
    try:
        rows = session.query(PatchPanelRow).all()
        for r in rows:
            session.expunge(r)
    finally:
        session.close()

    panels: list[PatchPanel] = []
    for row in rows:
        assigned = _count_assigned_ports(row.id)
        panels.append(_row_to_panel(row, assigned_ports=assigned))
    log.debug("patch_panels_listed", count=len(panels))
    return panels


def get_patch_panel(panel_id: int) -> PatchPanel:
    """Get a single patch panel by ID."""
    session = get_session()
    try:
        row = session.get(PatchPanelRow, panel_id)
        if row is None:
            msg = f"Patch panel {panel_id} not found"
            raise ValueError(msg)
        session.expunge(row)
    finally:
        session.close()
    assigned = _count_assigned_ports(row.id)
    return _row_to_panel(row, assigned_ports=assigned)


def create_patch_panel(data: PatchPanelInput) -> PatchPanel:
    """Create a new patch panel."""
    session = get_session()
    try:
        row = PatchPanelRow(
            name=data.name,
            port_count=data.port_count,
            panel_type=data.panel_type,
            rack_mounted=int(data.rack_mounted),
            rack_item_id=data.rack_item_id,
            location=data.location,
            notes=data.notes,
        )
        session.add(row)
        session.commit()
        panel_id = row.id
        session.expunge(row)
        log.info("patch_panel_created", panel_id=panel_id, name=data.name)
    finally:
        session.close()
    return get_patch_panel(panel_id)


def update_patch_panel(panel_id: int, data: PatchPanelInput) -> PatchPanel:
    """Update an existing patch panel."""
    session = get_session()
    try:
        row = session.get(PatchPanelRow, panel_id)
        if row is None:
            msg = f"Patch panel {panel_id} not found"
            raise ValueError(msg)
        row.name = data.name
        row.port_count = data.port_count
        row.panel_type = data.panel_type
        row.rack_mounted = int(data.rack_mounted)
        row.rack_item_id = data.rack_item_id
        row.location = data.location
        row.notes = data.notes
        session.commit()
        log.info("patch_panel_updated", panel_id=panel_id)
    finally:
        session.close()
    return get_patch_panel(panel_id)


def delete_patch_panel(panel_id: int) -> None:
    """Delete a patch panel."""
    session = get_session()
    try:
        row = session.get(PatchPanelRow, panel_id)
        if row is None:
            msg = f"Patch panel {panel_id} not found"
            raise ValueError(msg)
        session.delete(row)
        session.commit()
        log.info("patch_panel_deleted", panel_id=panel_id)
    finally:
        session.close()


# ── Label Settings ──


def get_label_settings() -> CableLabelSettings:
    """Get the cable label settings (creates defaults if missing)."""
    session = get_session()
    try:
        row = session.get(CableLabelSettingsRow, 1)
        if row is None:
            row = CableLabelSettingsRow(id=1)
            session.add(row)
            session.commit()
        result = CableLabelSettings(
            mode=row.mode,
            prefix=row.prefix,
            next_number=row.next_number,
            custom_pattern=row.custom_pattern,
        )
        session.expunge(row)
        return result
    finally:
        session.close()


def save_label_settings(data: CableLabelSettings) -> None:
    """Save cable label settings (upsert singleton row)."""
    session = get_session()
    try:
        row = session.get(CableLabelSettingsRow, 1)
        if row is None:
            row = CableLabelSettingsRow(id=1)
            session.add(row)
        row.mode = data.mode
        row.prefix = data.prefix
        row.next_number = data.next_number
        row.custom_pattern = data.custom_pattern
        session.commit()
        log.info("cable_label_settings_saved", mode=data.mode, prefix=data.prefix)
    finally:
        session.close()


# ── LLDP Sync ──


def _infer_cable_type(speed: int | None) -> str:
    """Infer cable type from link speed."""
    if speed is None:
        return "cat6"
    if speed > 2500:
        return "fiber-om3"
    return "cat6"


def sync_from_topology(credentials: UnifiCredentials) -> list[CableRun]:
    """Sync cable runs from LLDP topology edges.

    - Creates new cables for new connections
    - Updates speed/poe on existing cables
    - Marks disappeared connections as 'disconnected'
    - Never overwrites user-entered fields (color, length, label, patch_panel)
    - Skips wireless edges
    """
    from app.services.topology import get_topology_devices

    topology = get_topology_devices(credentials)

    # Build device name lookup
    device_names: dict[str, str] = {d.mac.lower(): d.name for d in topology.devices}

    # Load existing cables indexed by (source_mac, source_port)
    session = get_session()
    try:
        existing_rows = session.query(CableRunRow).all()
        for r in existing_rows:
            session.expunge(r)
    finally:
        session.close()

    # Index existing cables by (source_mac, dest_mac) pair for matching
    existing_index: dict[tuple[str, str], CableRunRow] = {}
    for row in existing_rows:
        if row.source_device_mac and row.dest_device_mac:
            existing_index[(row.source_device_mac.lower(), row.dest_device_mac.lower())] = row

    # Track which existing cables were seen in the current topology
    seen_keys: set[tuple[str, str]] = set()

    synced_ids: list[int] = []

    for edge in topology.edges:
        # Skip wireless edges
        if edge.wireless:
            continue

        key = (edge.from_mac.lower(), edge.to_mac.lower())
        seen_keys.add(key)

        if key in existing_index:
            # Update speed/poe on existing cable (never overwrite user fields)
            row = existing_index[key]
            session = get_session()
            try:
                db_row = session.get(CableRunRow, row.id)
                assert db_row is not None  # Row was fetched in the same transaction scope
                db_row.speed = edge.speed
                db_row.poe = int(edge.poe)
                db_row.dest_device_mac = edge.to_mac.lower()
                db_row.dest_port = edge.remote_port
                if db_row.status == "disconnected":
                    db_row.status = "active"
                session.commit()
                synced_ids.append(db_row.id)
            finally:
                session.close()
        else:
            # Create new cable
            cable_type = _infer_cable_type(edge.speed)
            label = _generate_label()
            session = get_session()
            try:
                new_row = CableRunRow(
                    source_device_mac=edge.from_mac.lower(),
                    source_port=edge.local_port,
                    dest_device_mac=edge.to_mac.lower(),
                    dest_port=edge.remote_port,
                    cable_type=cable_type,
                    speed=edge.speed,
                    poe=int(edge.poe),
                    status="active",
                    label=label,
                )
                session.add(new_row)
                session.commit()
                synced_ids.append(new_row.id)
                session.expunge(new_row)
            finally:
                session.close()

    # Mark disappeared connections as disconnected
    for key, row in existing_index.items():
        if key not in seen_keys and row.status == "active":
            session = get_session()
            try:
                db_row = session.get(CableRunRow, row.id)
                assert db_row is not None  # Row was fetched in the same transaction scope
                db_row.status = "disconnected"
                session.commit()
            finally:
                session.close()

    # Return all synced cables
    cables = [get_cable(cid, device_names) for cid in synced_ids]
    log.info("cables_synced", synced_count=len(cables))
    return cables
