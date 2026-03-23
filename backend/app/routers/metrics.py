"""Router for metrics endpoints."""

import asyncio

import structlog
from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import MetricsDevicesResponse, MetricsHistoryResponse, Notification
from app.services.metrics import (
    dismiss_notification,
    get_device_history,
    get_latest_snapshots,
    get_notifications,
)

log = structlog.get_logger()

router = APIRouter(tags=["metrics"])


def _fetch_live_stats() -> tuple[list[object], dict[str, str]]:  # pragma: no cover -- integration with live controller
    """Fetch current device stats for name/model enrichment. Returns (stats, ip_lookup)."""
    if not has_credentials():
        return [], {}
    credentials = get_unifi_config()
    if credentials is None:
        return [], {}
    from unifi_topology import fetch_device_stats, normalize_device_stats

    from app.services.firewall import to_topology_config

    config = to_topology_config(credentials)
    raw = fetch_device_stats(config, site=credentials.site)
    ip_lookup = {d.get("mac", ""): d.get("ip", "") for d in raw if isinstance(d, dict)}
    return list(normalize_device_stats(raw)), ip_lookup  # type: ignore[arg-type]


@router.get("/devices")
async def metrics_devices() -> MetricsDevicesResponse:
    live, ip_lookup = await asyncio.to_thread(_fetch_live_stats)
    snapshots = await asyncio.to_thread(get_latest_snapshots, current_stats=live or None, ip_lookup=ip_lookup or None)  # type: ignore[arg-type]
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


@router.post("/devices/{mac}/analyze")
async def analyze_device_metrics(mac: str) -> dict[str, str]:
    """AI analysis of a device's 24h metrics."""
    from app.services.ai_settings import get_full_ai_config
    from app.services.metrics_analyzer import analyze_device

    config = get_full_ai_config()
    if config is None:
        raise HTTPException(status_code=400, detail="AI provider not configured")

    history = get_device_history(mac, hours=24)
    if not history:
        raise HTTPException(status_code=404, detail="No metrics history for this device")

    live, ip_lookup = await asyncio.to_thread(_fetch_live_stats)
    snapshots = await asyncio.to_thread(get_latest_snapshots, current_stats=live or None, ip_lookup=ip_lookup or None)  # type: ignore[arg-type]
    device = next((s for s in snapshots if s.mac == mac), None)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    insight = await asyncio.to_thread(analyze_device, device, history, config)
    return {"insight": insight}
