"""Router for metrics endpoints."""

import structlog
from fastapi import APIRouter

from app.models import MetricsDevicesResponse, MetricsHistoryResponse, Notification
from app.services.metrics import (
    dismiss_notification,
    get_device_history,
    get_latest_snapshots,
    get_notifications,
)

log = structlog.get_logger()

router = APIRouter(tags=["metrics"])


@router.get("/devices")
async def metrics_devices() -> MetricsDevicesResponse:
    snapshots = get_latest_snapshots()
    return MetricsDevicesResponse(devices=snapshots)


@router.get("/devices/{mac}/history")
async def metrics_history(mac: str, hours: int = 24) -> MetricsHistoryResponse:
    history = get_device_history(mac, hours=hours)
    return MetricsHistoryResponse(mac=mac, history=history)


@router.get("/notifications")
async def metrics_notifications() -> list[Notification]:
    return get_notifications()


@router.post("/notifications/{notification_id}/dismiss")
async def dismiss(notification_id: int) -> dict[str, str]:
    dismiss_notification(notification_id)
    return {"status": "ok"}
