import asyncio

import structlog
from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import Zone
from app.services.firewall import get_zones

log = structlog.get_logger()

router = APIRouter(tags=["zones"])


@router.get("/zones")
async def list_zones() -> list[Zone]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None  # guaranteed by has_credentials()
    zones = await asyncio.to_thread(get_zones, credentials)
    log.info("zones_fetched", zone_count=len(zones))
    return zones
