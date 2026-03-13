"""Zone filter router for persisting hidden zone selections."""

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids

log = structlog.get_logger()

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ZoneFilterInput(BaseModel):
    hidden_zone_ids: list[str]


@router.get("/zone-filter")
async def get_zone_filter() -> dict[str, list[str]]:
    hidden = get_hidden_zone_ids()
    log.debug("zone_filter_get", hidden_count=len(hidden))
    return {"hidden_zone_ids": hidden}


@router.put("/zone-filter")
async def save_zone_filter(body: ZoneFilterInput) -> dict[str, str]:
    log.info("zone_filter_save", hidden_count=len(body.hidden_zone_ids))
    save_hidden_zone_ids(body.hidden_zone_ids)
    return {"status": "ok"}
