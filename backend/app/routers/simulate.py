import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_unifi_config, has_credentials
from app.services.firewall import get_rules, get_zones
from app.services.simulator import SimulationResult, evaluate_rules, resolve_zone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["simulate"])


class SimulateRequest(BaseModel):
    src_ip: str
    dst_ip: str
    protocol: str | None = None
    port: int | None = None
    source_port: int | None = None


@router.post("/simulate")
async def simulate(request: SimulateRequest) -> SimulationResult:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None  # guaranteed by has_credentials()

    logger.debug(
        "Simulate: src_ip=%s, dst_ip=%s, proto=%s, port=%s, src_port=%s",
        request.src_ip, request.dst_ip, request.protocol, request.port, request.source_port,
    )

    zones = get_zones(credentials)
    rules = get_rules(credentials)

    src_zone_id = resolve_zone(request.src_ip, zones)
    dst_zone_id = resolve_zone(request.dst_ip, zones)

    if src_zone_id is None:
        logger.debug("Could not resolve source IP %s to a zone", request.src_ip)
        raise HTTPException(status_code=400, detail=f"Could not resolve source IP {request.src_ip} to a zone")
    if dst_zone_id is None:
        logger.debug("Could not resolve destination IP %s to a zone", request.dst_ip)
        raise HTTPException(status_code=400, detail=f"Could not resolve destination IP {request.dst_ip} to a zone")

    logger.debug("Resolved zones: %s -> %s", src_zone_id, dst_zone_id)

    result = evaluate_rules(
        rules, src_zone_id, dst_zone_id,
        request.protocol, request.port,
        source_ip=request.src_ip,
        destination_ip=request.dst_ip,
        source_port=request.source_port,
    )

    # Fill in zone names
    zone_map = {z.id: z.name for z in zones}
    result.source_zone_name = zone_map.get(src_zone_id, "")
    result.destination_zone_name = zone_map.get(dst_zone_id, "")

    logger.debug("Simulation verdict: %s (matched_rule=%s)", result.verdict, result.matched_rule_name)
    return result
