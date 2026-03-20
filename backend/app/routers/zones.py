import asyncio

import structlog
from fastapi import APIRouter

from app.config import RequireCredentials
from app.models import Zone
from app.services.firewall import get_zones

log = structlog.get_logger()

router = APIRouter(tags=["zones"])


@router.get("/zones")
async def list_zones(credentials: RequireCredentials) -> list[Zone]:
    zones = await asyncio.to_thread(get_zones, credentials)
    log.info("zones_fetched", zone_count=len(zones))
    return zones
