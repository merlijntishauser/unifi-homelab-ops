"""Router for rack planner endpoints."""

import structlog
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.config import get_unifi_config, has_credentials
from app.models import BomResponse, Rack, RackInput, RackItem, RackItemInput, RackSummary
from app.services.rack_planner import (
    add_rack_item,
    create_rack,
    delete_rack,
    delete_rack_item,
    get_bom,
    get_rack,
    import_from_topology,
    list_racks,
    move_rack_item,
    update_rack,
    update_rack_item,
)

log = structlog.get_logger()

router = APIRouter(tags=["rack-planner"])


class MoveRequest(BaseModel):
    position_u: int


@router.get("")
async def rack_list() -> list[RackSummary]:
    return list_racks()


@router.post("", status_code=201)
async def rack_create(data: RackInput) -> Rack:
    return create_rack(data)


@router.get("/{rack_id}")
async def rack_get(rack_id: int) -> Rack:
    try:
        return get_rack(rack_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{rack_id}")
async def rack_update(rack_id: int, data: RackInput) -> Rack:
    try:
        return update_rack(rack_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{rack_id}", status_code=204)
async def rack_delete(rack_id: int) -> Response:
    try:
        delete_rack(rack_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/{rack_id}/items", status_code=201)
async def rack_item_add(rack_id: int, data: RackItemInput) -> RackItem:
    try:
        return add_rack_item(rack_id, data)
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail:
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=409, detail=detail) from exc


@router.put("/{rack_id}/items/{item_id}")
async def rack_item_update(rack_id: int, item_id: int, data: RackItemInput) -> RackItem:
    try:
        return update_rack_item(rack_id, item_id, data)
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail:
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=409, detail=detail) from exc


@router.delete("/{rack_id}/items/{item_id}", status_code=204)
async def rack_item_delete(rack_id: int, item_id: int) -> Response:
    try:
        delete_rack_item(rack_id, item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.patch("/{rack_id}/items/{item_id}/move")
async def rack_item_move(rack_id: int, item_id: int, body: MoveRequest) -> RackItem:
    try:
        return move_rack_item(rack_id, item_id, body.position_u)
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail:
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=409, detail=detail) from exc


@router.get("/{rack_id}/bom")
async def rack_bom(rack_id: int) -> BomResponse:
    try:
        return get_bom(rack_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{rack_id}/import")
async def rack_import(rack_id: int) -> list[RackItem]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None

    try:
        return import_from_topology(rack_id, credentials)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
