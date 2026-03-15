"""Background poller for device metrics collection."""

from __future__ import annotations

import asyncio
import time

import structlog
from unifi_topology import DeviceStats, fetch_device_stats, normalize_device_stats

from app.config import get_unifi_config, has_credentials
from app.services.anomaly_checker import AnomalyResult, run_checks
from app.services.firewall import to_topology_config
from app.services.metrics import (
    create_notification,
    get_device_history,
    prune_old_data,
    record_snapshot,
    resolve_notifications,
)

log = structlog.get_logger()

_POLL_INTERVAL = 30
_PRUNE_INTERVAL = 3600  # one hour
_last_prune_time: float = 0.0
_previous_stats: dict[str, DeviceStats] = {}

# All check IDs that the anomaly checker can produce
_ALL_CHECK_IDS = frozenset({
    "reboot_detected",
    "high_cpu",
    "high_memory",
    "high_temperature",
    "poe_overload",
    "firmware_mismatch",
})


def _check_anomalies(stats: list[DeviceStats]) -> None:
    """Run anomaly checks and create/resolve notifications."""
    global _previous_stats  # noqa: PLW0603

    # Build history lookup for sustained checks
    history_lookup = {}
    for s in stats:
        history_lookup[s.mac] = get_device_history(s.mac, hours=1)

    results = run_checks(stats, _previous_stats, history_lookup)

    # Track which (mac, check_id) combos have active anomalies
    active_anomalies: set[tuple[str, str]] = set()
    for result in results:
        active_anomalies.add((result.device_mac, result.check_id))
        _create_notification_from_result(result)

    # Resolve notifications for checks that are no longer anomalous
    for s in stats:
        for check_id in _ALL_CHECK_IDS:
            if (s.mac, check_id) not in active_anomalies:
                resolve_notifications(s.mac, check_id)

    # Store current stats as previous for next cycle
    _previous_stats = {s.mac: s for s in stats}


def _create_notification_from_result(result: AnomalyResult) -> None:
    """Create a notification from an anomaly result if one doesn't already exist."""
    from app.services.metrics import get_notifications

    existing = get_notifications(include_resolved=False)
    for n in existing:
        if n.device_mac == result.device_mac and n.check_id == result.check_id:
            return  # Already has an active notification
    create_notification(
        device_mac=result.device_mac,
        check_id=result.check_id,
        severity=result.severity,
        title=result.title,
        message=result.message,
    )


def _maybe_prune() -> None:
    """Prune old data at most once per hour."""
    global _last_prune_time  # noqa: PLW0603
    now = time.monotonic()
    if now - _last_prune_time >= _PRUNE_INTERVAL:
        prune_old_data()
        _last_prune_time = now


async def start_metrics_poller() -> None:
    """Background task that polls device stats every 30 seconds."""
    while True:
        try:
            if has_credentials():
                credentials = get_unifi_config()
                assert credentials is not None
                config = to_topology_config(credentials)
                raw_stats = fetch_device_stats(config, site=credentials.site)
                stats = normalize_device_stats(raw_stats)  # type: ignore[arg-type]
                record_snapshot(stats)
                _check_anomalies(stats)
                _maybe_prune()
        except Exception:
            log.exception("metrics_poll_error")
        await asyncio.sleep(_POLL_INTERVAL)
