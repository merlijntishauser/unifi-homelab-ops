"""Tests for anomaly checker service."""

from unifi_topology import DeviceStats, PoePortStats

from app.models import MetricsHistoryPoint
from app.services.anomaly_checker import (
    AnomalyResult,
    _check_firmware_mismatch,
    _check_high_cpu,
    _check_high_memory,
    _check_high_temperature,
    _check_poe_overload,
    _check_reboot,
    run_checks,
)


def _make_stats(
    mac: str = "aa:bb:cc:dd:ee:01",
    name: str = "Switch",
    model: str = "USW-24",
    device_type: str = "switch",
    cpu: float = 10.0,
    mem: float = 30.0,
    temperature: float | None = None,
    uptime: int = 86400,
    version: str = "7.1.0",
    poe_ports: list[PoePortStats] | None = None,
    poe_budget: float | None = None,
) -> DeviceStats:
    return DeviceStats(
        mac=mac,
        name=name,
        model=model,
        type=device_type,
        cpu=cpu,
        mem=mem,
        temperature=temperature,
        uptime=uptime,
        version=version,
        poe_ports=poe_ports or [],
        poe_budget=poe_budget,
    )


def _make_history_point(cpu: float = 10.0, mem: float = 30.0) -> MetricsHistoryPoint:
    return MetricsHistoryPoint(
        timestamp="2026-03-15T00:00:00+00:00",
        cpu=cpu,
        mem=mem,
    )


class TestCheckReboot:
    def test_detects_reboot(self) -> None:
        current = _make_stats(uptime=100)
        previous = _make_stats(uptime=86400)
        result = _check_reboot(current, previous)
        assert result is not None
        assert result.check_id == "reboot_detected"
        assert result.severity == "critical"

    def test_no_reboot_when_uptime_increases(self) -> None:
        current = _make_stats(uptime=86500)
        previous = _make_stats(uptime=86400)
        result = _check_reboot(current, previous)
        assert result is None

    def test_no_reboot_when_no_previous(self) -> None:
        current = _make_stats(uptime=100)
        result = _check_reboot(current, None)
        assert result is None

    def test_no_reboot_when_uptime_same(self) -> None:
        current = _make_stats(uptime=86400)
        previous = _make_stats(uptime=86400)
        result = _check_reboot(current, previous)
        assert result is None


class TestCheckHighCpu:
    def test_detects_sustained_high_cpu(self) -> None:
        history = [_make_history_point(cpu=85.0) for _ in range(9)]
        current = _make_stats(cpu=85.0)
        result = _check_high_cpu(current, history)
        assert result is not None
        assert result.check_id == "high_cpu"
        assert result.severity == "warning"

    def test_no_alert_when_not_enough_readings(self) -> None:
        history = [_make_history_point(cpu=85.0) for _ in range(5)]
        current = _make_stats(cpu=85.0)
        result = _check_high_cpu(current, history)
        assert result is None

    def test_no_alert_when_cpu_dips(self) -> None:
        history = [_make_history_point(cpu=85.0) for _ in range(8)]
        history.append(_make_history_point(cpu=50.0))
        current = _make_stats(cpu=85.0)
        result = _check_high_cpu(current, history)
        assert result is None

    def test_no_alert_when_empty_history(self) -> None:
        current = _make_stats(cpu=85.0)
        result = _check_high_cpu(current, [])
        assert result is None

    def test_no_alert_when_cpu_below_threshold(self) -> None:
        history = [_make_history_point(cpu=70.0) for _ in range(9)]
        current = _make_stats(cpu=70.0)
        result = _check_high_cpu(current, history)
        assert result is None

    def test_boundary_cpu_exactly_80_not_triggered(self) -> None:
        history = [_make_history_point(cpu=80.0) for _ in range(9)]
        current = _make_stats(cpu=80.0)
        result = _check_high_cpu(current, history)
        assert result is None


class TestCheckHighMemory:
    def test_detects_high_memory(self) -> None:
        current = _make_stats(mem=90.0)
        result = _check_high_memory(current)
        assert result is not None
        assert result.check_id == "high_memory"
        assert result.severity == "warning"

    def test_no_alert_below_threshold(self) -> None:
        current = _make_stats(mem=80.0)
        result = _check_high_memory(current)
        assert result is None

    def test_boundary_exactly_85_not_triggered(self) -> None:
        current = _make_stats(mem=85.0)
        result = _check_high_memory(current)
        assert result is None


class TestCheckHighTemperature:
    def test_detects_critical_temperature(self) -> None:
        current = _make_stats(temperature=96.0)
        result = _check_high_temperature(current)
        assert result is not None
        assert result.check_id == "high_temperature"
        assert result.severity == "critical"

    def test_detects_warning_temperature(self) -> None:
        current = _make_stats(temperature=85.0)
        result = _check_high_temperature(current)
        assert result is not None
        assert result.check_id == "high_temperature"
        assert result.severity == "warning"

    def test_no_alert_below_warning(self) -> None:
        current = _make_stats(temperature=70.0)
        result = _check_high_temperature(current)
        assert result is None

    def test_no_alert_when_no_temperature(self) -> None:
        current = _make_stats(temperature=None)
        result = _check_high_temperature(current)
        assert result is None

    def test_boundary_exactly_80_not_triggered(self) -> None:
        current = _make_stats(temperature=80.0)
        result = _check_high_temperature(current)
        assert result is None

    def test_boundary_exactly_95_not_triggered_as_critical(self) -> None:
        current = _make_stats(temperature=95.0)
        result = _check_high_temperature(current)
        assert result is not None
        assert result.severity == "warning"


class TestCheckPoeOverload:
    def test_detects_poe_overload(self) -> None:
        poe_ports = [PoePortStats(port_idx=1, poe_power=95.0, poe_mode="auto")]
        current = _make_stats(poe_ports=poe_ports, poe_budget=100.0)
        result = _check_poe_overload(current)
        assert result is not None
        assert result.check_id == "poe_overload"
        assert result.severity == "warning"

    def test_no_alert_below_threshold(self) -> None:
        poe_ports = [PoePortStats(port_idx=1, poe_power=80.0, poe_mode="auto")]
        current = _make_stats(poe_ports=poe_ports, poe_budget=100.0)
        result = _check_poe_overload(current)
        assert result is None

    def test_no_alert_without_budget(self) -> None:
        poe_ports = [PoePortStats(port_idx=1, poe_power=95.0, poe_mode="auto")]
        current = _make_stats(poe_ports=poe_ports, poe_budget=None)
        result = _check_poe_overload(current)
        assert result is None

    def test_no_alert_with_zero_budget(self) -> None:
        poe_ports = [PoePortStats(port_idx=1, poe_power=95.0, poe_mode="auto")]
        current = _make_stats(poe_ports=poe_ports, poe_budget=0.0)
        result = _check_poe_overload(current)
        assert result is None

    def test_no_alert_with_no_poe_ports(self) -> None:
        current = _make_stats(poe_ports=[], poe_budget=100.0)
        result = _check_poe_overload(current)
        assert result is None

    def test_multiple_ports_summed(self) -> None:
        poe_ports = [
            PoePortStats(port_idx=1, poe_power=50.0, poe_mode="auto"),
            PoePortStats(port_idx=2, poe_power=45.0, poe_mode="auto"),
        ]
        current = _make_stats(poe_ports=poe_ports, poe_budget=100.0)
        result = _check_poe_overload(current)
        assert result is not None


class TestCheckFirmwareMismatch:
    def test_detects_mismatch(self) -> None:
        current = _make_stats(mac="aa:01", version="6.0.0", model="USW-24")
        others = [
            _make_stats(mac="aa:02", version="7.1.0", model="USW-24"),
            _make_stats(mac="aa:03", version="7.1.0", model="USW-24"),
            current,
        ]
        result = _check_firmware_mismatch(current, others)
        assert result is not None
        assert result.check_id == "firmware_mismatch"

    def test_no_mismatch_when_same_version(self) -> None:
        current = _make_stats(mac="aa:01", version="7.1.0", model="USW-24")
        others = [
            _make_stats(mac="aa:02", version="7.1.0", model="USW-24"),
            current,
        ]
        result = _check_firmware_mismatch(current, others)
        assert result is None

    def test_no_mismatch_when_single_device(self) -> None:
        current = _make_stats(mac="aa:01", version="7.1.0", model="USW-24")
        result = _check_firmware_mismatch(current, [current])
        assert result is None

    def test_no_mismatch_when_no_version(self) -> None:
        current = _make_stats(version="")
        result = _check_firmware_mismatch(current, [current])
        assert result is None

    def test_no_mismatch_different_models(self) -> None:
        current = _make_stats(mac="aa:01", version="6.0.0", model="USW-24")
        others = [
            _make_stats(mac="aa:02", version="7.1.0", model="USW-48"),
            current,
        ]
        result = _check_firmware_mismatch(current, others)
        assert result is None

    def test_no_mismatch_when_split_versions(self) -> None:
        """No majority when versions are evenly split."""
        current = _make_stats(mac="aa:01", version="6.0.0", model="USW-24")
        others = [
            _make_stats(mac="aa:02", version="7.1.0", model="USW-24"),
            current,
        ]
        result = _check_firmware_mismatch(current, others)
        assert result is None


class TestRunChecks:
    def test_returns_empty_for_healthy_devices(self) -> None:
        stats = [_make_stats()]
        results = run_checks(stats, {}, {})
        assert results == []

    def test_returns_multiple_anomalies(self) -> None:
        current = _make_stats(cpu=90.0, mem=90.0, temperature=96.0, uptime=100)
        previous = _make_stats(uptime=86400)
        history = [_make_history_point(cpu=90.0) for _ in range(9)]
        results = run_checks(
            [current],
            {current.mac: previous},
            {current.mac: history},
        )
        check_ids = {r.check_id for r in results}
        assert "reboot_detected" in check_ids
        assert "high_cpu" in check_ids
        assert "high_memory" in check_ids
        assert "high_temperature" in check_ids

    def test_all_results_are_anomaly_result(self) -> None:
        current = _make_stats(mem=90.0)
        results = run_checks([current], {}, {})
        assert all(isinstance(r, AnomalyResult) for r in results)

    def test_poe_overload_via_run_checks(self) -> None:
        poe_ports = [PoePortStats(port_idx=1, poe_power=95.0, poe_mode="auto")]
        current = _make_stats(poe_ports=poe_ports, poe_budget=100.0)
        results = run_checks([current], {}, {})
        check_ids = {r.check_id for r in results}
        assert "poe_overload" in check_ids

    def test_firmware_mismatch_via_run_checks(self) -> None:
        dev1 = _make_stats(mac="aa:01", version="6.0.0")
        dev2 = _make_stats(mac="aa:02", version="7.1.0")
        dev3 = _make_stats(mac="aa:03", version="7.1.0")
        results = run_checks([dev1, dev2, dev3], {}, {})
        check_ids = {r.check_id for r in results}
        assert "firmware_mismatch" in check_ids
