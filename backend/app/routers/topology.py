"""Router for topology endpoints."""

import asyncio

import structlog
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.config import RequireCredentials
from app.models import NodePosition, TopologyDevicesResponse, TopologySvgResponse
from app.services.topology import VALID_PROJECTIONS, get_topology_devices, get_topology_svg
from app.services.topology_positions import delete_all_positions, get_node_positions, save_node_positions

log = structlog.get_logger()

router = APIRouter(tags=["topology"])


@router.get("/svg")
async def topology_svg(
    credentials: RequireCredentials,
    color_mode: str = "dark",
    projection: str = "isometric",
) -> TopologySvgResponse:
    if projection not in VALID_PROJECTIONS:
        valid = ", ".join(VALID_PROJECTIONS)
        raise HTTPException(status_code=400, detail=f"Invalid projection: {projection}. Valid: {valid}")

    try:
        svg = await asyncio.to_thread(get_topology_svg, credentials, color_mode=color_mode, projection=projection)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log.info("topology_svg_served", projection=projection)
    return TopologySvgResponse(svg=svg, projection=projection)


@router.get("/devices")
async def topology_devices(credentials: RequireCredentials) -> TopologyDevicesResponse:
    return await asyncio.to_thread(get_topology_devices, credentials)


@router.get("/positions")
async def get_positions() -> list[NodePosition]:
    return get_node_positions()


class NodePositionsInput(BaseModel):
    positions: list[NodePosition]


@router.put("/positions")
async def save_positions(body: NodePositionsInput) -> dict[str, str]:
    save_node_positions(body.positions)
    return {"status": "ok"}


@router.delete("/positions", status_code=204)
async def reset_positions() -> Response:
    delete_all_positions()
    return Response(status_code=204)
