"""Router for snoozed device management."""

import structlog
from fastapi import APIRouter

from app.models import SnoozedDevicesResponse, SnoozeRequest
from app.services.snoozed_devices import get_snoozed, snooze_devices, unsnooze_device

log = structlog.get_logger()

router = APIRouter(tags=["snoozed-devices"])


@router.get("/snoozed")
async def list_snoozed() -> SnoozedDevicesResponse:
    return SnoozedDevicesResponse(devices=get_snoozed())


@router.post("/snoozed")
async def snooze(body: SnoozeRequest) -> SnoozedDevicesResponse:
    log.info("snooze_request", count=len(body.devices))
    snooze_devices(body.devices)
    return SnoozedDevicesResponse(devices=get_snoozed())


@router.delete("/snoozed/{mac}")
async def unsnooze(mac: str) -> SnoozedDevicesResponse:
    log.info("unsnooze_request", mac=mac)
    unsnooze_device(mac)
    return SnoozedDevicesResponse(devices=get_snoozed())
