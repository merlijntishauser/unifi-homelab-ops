"""Router for cabling module endpoints."""

import asyncio

import structlog
from fastapi import APIRouter, HTTPException, Response

from app.config import RequireCredentials
from app.models import CableLabelSettings, CableRun, CableRunInput, PatchPanel, PatchPanelInput
from app.services.cable_service import (
    create_cable,
    create_patch_panel,
    delete_cable,
    delete_patch_panel,
    get_label_settings,
    list_cables,
    list_patch_panels,
    save_label_settings,
    sync_from_topology,
    update_cable,
    update_patch_panel,
)

log = structlog.get_logger()

cable_router = APIRouter(tags=["cabling"])
panel_router = APIRouter(tags=["cabling"])
label_settings_router = APIRouter(tags=["cabling"])


# ── Cable endpoints ──


def _fetch_device_names() -> dict[str, str]:
    """Fetch device names from topology for cable enrichment."""
    from app.config import get_unifi_config, has_credentials

    if not has_credentials():
        return {}
    credentials = get_unifi_config()
    if credentials is None:
        return {}
    from app.services.topology import get_topology_devices

    try:
        topology = get_topology_devices(credentials)
        return {d.mac.lower(): d.name for d in topology.devices}
    except Exception:  # noqa: BLE001
        return {}


@cable_router.get("")
async def cables_list() -> list[CableRun]:
    device_names = await asyncio.to_thread(_fetch_device_names)
    return list_cables(device_names or None)


@cable_router.post("", status_code=201)
async def cables_create(data: CableRunInput) -> CableRun:
    return create_cable(data)


@cable_router.put("/{cable_id}")
async def cables_update(cable_id: int, data: CableRunInput) -> CableRun:
    try:
        return update_cable(cable_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@cable_router.delete("/{cable_id}", status_code=204)
async def cables_delete(cable_id: int) -> Response:
    try:
        delete_cable(cable_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@cable_router.post("/sync")
async def cables_sync(credentials: RequireCredentials) -> list[CableRun]:
    return await asyncio.to_thread(sync_from_topology, credentials)


# ── Patch Panel endpoints ──


@panel_router.get("")
async def panels_list() -> list[PatchPanel]:
    return list_patch_panels()


@panel_router.post("", status_code=201)
async def panels_create(data: PatchPanelInput) -> PatchPanel:
    return create_patch_panel(data)


@panel_router.put("/{panel_id}")
async def panels_update(panel_id: int, data: PatchPanelInput) -> PatchPanel:
    try:
        return update_patch_panel(panel_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@panel_router.delete("/{panel_id}", status_code=204)
async def panels_delete(panel_id: int) -> Response:
    try:
        delete_patch_panel(panel_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


# ── Label Settings endpoints ──


@label_settings_router.get("")
async def label_settings_get() -> CableLabelSettings:
    return get_label_settings()


@label_settings_router.put("")
async def label_settings_update(data: CableLabelSettings) -> CableLabelSettings:
    save_label_settings(data)
    return get_label_settings()
