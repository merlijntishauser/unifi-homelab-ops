"""Anomaly detection checks for device metrics.

Pure functions that compare current stats against previous snapshots
and historical readings to detect anomalies. No database access.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from unifi_topology import DeviceStats

    from app.models import MetricsHistoryPoint

_HIGH_CPU_THRESHOLD = 80.0
_HIGH_CPU_CONSECUTIVE = 10
_HIGH_MEM_THRESHOLD = 85.0
_TEMP_WARNING_THRESHOLD = 80.0
_TEMP_CRITICAL_THRESHOLD = 95.0
_POE_OVERLOAD_PERCENT = 0.9


@dataclass(frozen=True)
class AnomalyResult:
    """Result of an anomaly check."""

    check_id: str
    severity: str
    title: str
    message: str
    device_mac: str


def _check_reboot(current: DeviceStats, previous: DeviceStats | None) -> AnomalyResult | None:
    """Detect device reboot: uptime decreased compared to previous snapshot."""
    if previous is None:
        return None
    if current.uptime < previous.uptime:
        return AnomalyResult(
            check_id="reboot_detected",
            severity="critical",
            title=f"{current.name} rebooted",
            message=(
                f"Device {current.name} ({current.mac}) uptime dropped "
                f"from {previous.uptime}s to {current.uptime}s"
            ),
            device_mac=current.mac,
        )
    return None


def _check_high_cpu(current: DeviceStats, history: list[MetricsHistoryPoint]) -> AnomalyResult | None:
    """Detect sustained high CPU: above threshold for last N consecutive readings."""
    recent = history[-(_HIGH_CPU_CONSECUTIVE - 1):] if history else []
    all_readings = [h.cpu for h in recent] + [current.cpu]
    if len(all_readings) < _HIGH_CPU_CONSECUTIVE:
        return None
    if all(cpu > _HIGH_CPU_THRESHOLD for cpu in all_readings):
        return AnomalyResult(
            check_id="high_cpu",
            severity="warning",
            title=f"{current.name} sustained high CPU",
            message=(
                f"Device {current.name} ({current.mac}) CPU above {_HIGH_CPU_THRESHOLD}% "
                f"for {_HIGH_CPU_CONSECUTIVE} consecutive readings"
            ),
            device_mac=current.mac,
        )
    return None


def _check_high_memory(current: DeviceStats) -> AnomalyResult | None:
    """Detect high memory usage."""
    if current.mem > _HIGH_MEM_THRESHOLD:
        return AnomalyResult(
            check_id="high_memory",
            severity="warning",
            title=f"{current.name} high memory usage",
            message=(
                f"Device {current.name} ({current.mac}) memory at "
                f"{current.mem:.1f}% (threshold: {_HIGH_MEM_THRESHOLD}%)"
            ),
            device_mac=current.mac,
        )
    return None


def _check_high_temperature(current: DeviceStats) -> AnomalyResult | None:
    """Detect high temperature: warning above 80, critical above 95."""
    if current.temperature is None:
        return None
    if current.temperature > _TEMP_CRITICAL_THRESHOLD:
        return AnomalyResult(
            check_id="high_temperature",
            severity="critical",
            title=f"{current.name} critical temperature",
            message=(
                f"Device {current.name} ({current.mac}) temperature at "
                f"{current.temperature:.1f}C (critical threshold: {_TEMP_CRITICAL_THRESHOLD}C)"
            ),
            device_mac=current.mac,
        )
    if current.temperature > _TEMP_WARNING_THRESHOLD:
        return AnomalyResult(
            check_id="high_temperature",
            severity="warning",
            title=f"{current.name} high temperature",
            message=(
                f"Device {current.name} ({current.mac}) temperature at "
                f"{current.temperature:.1f}C (warning threshold: {_TEMP_WARNING_THRESHOLD}C)"
            ),
            device_mac=current.mac,
        )
    return None


def _check_poe_overload(current: DeviceStats) -> AnomalyResult | None:
    """Detect PoE overload: consumption > 90% of budget."""
    if current.poe_budget is None or current.poe_budget <= 0:
        return None
    total_poe = sum(p.poe_power for p in current.poe_ports)
    if total_poe <= 0:
        return None
    ratio = total_poe / current.poe_budget
    if ratio > _POE_OVERLOAD_PERCENT:
        return AnomalyResult(
            check_id="poe_overload",
            severity="warning",
            title=f"{current.name} PoE near capacity",
            message=(
                f"Device {current.name} ({current.mac}) PoE consumption {total_poe:.1f}W "
                f"of {current.poe_budget:.1f}W budget ({ratio * 100:.0f}%)"
            ),
            device_mac=current.mac,
        )
    return None


def _check_firmware_mismatch(current: DeviceStats, all_stats: list[DeviceStats]) -> AnomalyResult | None:
    """Detect firmware mismatch: version differs from majority of same model."""
    if not current.version:
        return None
    same_model = [s for s in all_stats if s.model == current.model and s.version]
    if len(same_model) < 2:
        return None
    version_counts: dict[str, int] = {}
    for s in same_model:
        version_counts[s.version] = version_counts.get(s.version, 0) + 1
    majority_version = max(version_counts, key=lambda v: version_counts[v])
    if current.version != majority_version and version_counts[majority_version] > len(same_model) // 2:
        return AnomalyResult(
            check_id="firmware_mismatch",
            severity="warning",
            title=f"{current.name} firmware mismatch",
            message=(
                f"Device {current.name} ({current.mac}) running {current.version} "
                f"while majority of {current.model} devices run {majority_version}"
            ),
            device_mac=current.mac,
        )
    return None


def run_checks(
    current_stats: list[DeviceStats],
    previous_stats: dict[str, DeviceStats],
    device_metrics_history: dict[str, list[MetricsHistoryPoint]],
) -> list[AnomalyResult]:
    """Run all anomaly checks across all devices.

    Args:
        current_stats: Current device stats from the controller.
        previous_stats: Previous snapshot keyed by MAC address.
        device_metrics_history: Recent history per device MAC for sustained checks.

    Returns:
        List of anomaly results.
    """
    results: list[AnomalyResult] = []
    for stats in current_stats:
        previous = previous_stats.get(stats.mac)
        history = device_metrics_history.get(stats.mac, [])

        reboot = _check_reboot(stats, previous)
        if reboot:
            results.append(reboot)

        high_cpu = _check_high_cpu(stats, history)
        if high_cpu:
            results.append(high_cpu)

        high_mem = _check_high_memory(stats)
        if high_mem:
            results.append(high_mem)

        high_temp = _check_high_temperature(stats)
        if high_temp:
            results.append(high_temp)

        poe = _check_poe_overload(stats)
        if poe:
            results.append(poe)

        firmware = _check_firmware_mismatch(stats, current_stats)
        if firmware:
            results.append(firmware)

    return results
