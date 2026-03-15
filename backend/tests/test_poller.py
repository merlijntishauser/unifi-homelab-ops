"""Tests for the background metrics poller."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from unifi_topology import DeviceStats, PoePortStats

from app.database import init_db_for_tests, reset_engine
from app.services.metrics import create_notification, get_notifications
from app.services.poller import (
    _PRUNE_INTERVAL,
    _check_anomalies,
    _create_notification_from_result,
    _maybe_prune,
    start_metrics_poller,
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


@pytest.fixture(autouse=True)
def _reset_poller_state() -> Iterator[None]:
    """Reset poller globals between tests."""
    import app.services.poller as poller_mod
    poller_mod._previous_stats = {}
    poller_mod._last_prune_time = 0.0
    yield
    poller_mod._previous_stats = {}
    poller_mod._last_prune_time = 0.0


def _make_stats(
    mac: str = "aa:bb:cc:dd:ee:01",
    name: str = "Switch",
    cpu: float = 10.0,
    mem: float = 30.0,
    uptime: int = 86400,
    version: str = "7.1.0",
    poe_ports: list[PoePortStats] | None = None,
    poe_budget: float | None = None,
) -> DeviceStats:
    return DeviceStats(
        mac=mac,
        name=name,
        model="USW-24",
        type="switch",
        cpu=cpu,
        mem=mem,
        uptime=uptime,
        version=version,
        poe_ports=poe_ports or [],
        poe_budget=poe_budget,
    )


class TestCheckAnomalies:
    def test_creates_notification_on_anomaly(self) -> None:
        stats = [_make_stats(mem=90.0)]
        _check_anomalies(stats)
        notifications = get_notifications()
        assert len(notifications) == 1
        assert notifications[0].check_id == "high_memory"

    def test_resolves_when_anomaly_clears(self) -> None:
        # First poll: anomaly exists
        stats_bad = [_make_stats(mem=90.0)]
        _check_anomalies(stats_bad)
        assert len(get_notifications(include_resolved=False)) == 1

        # Second poll: anomaly cleared
        stats_good = [_make_stats(mem=50.0)]
        _check_anomalies(stats_good)
        active = get_notifications(include_resolved=False)
        assert len(active) == 0

    def test_does_not_duplicate_notifications(self) -> None:
        stats = [_make_stats(mem=90.0)]
        _check_anomalies(stats)
        _check_anomalies(stats)
        notifications = get_notifications(include_resolved=False)
        assert len(notifications) == 1

    def test_stores_previous_stats(self) -> None:
        import app.services.poller as poller_mod
        stats = [_make_stats()]
        _check_anomalies(stats)
        assert "aa:bb:cc:dd:ee:01" in poller_mod._previous_stats

    def test_detects_reboot_on_second_poll(self) -> None:
        stats1 = [_make_stats(uptime=86400)]
        _check_anomalies(stats1)
        stats2 = [_make_stats(uptime=100)]
        _check_anomalies(stats2)
        notifications = get_notifications()
        check_ids = {n.check_id for n in notifications}
        assert "reboot_detected" in check_ids


class TestCreateNotificationFromResult:
    def test_creates_new_notification(self) -> None:
        from app.services.anomaly_checker import AnomalyResult
        result = AnomalyResult(
            check_id="test_check",
            severity="warning",
            title="Test",
            message="Test message",
            device_mac="aa:01",
        )
        _create_notification_from_result(result)
        notifications = get_notifications()
        assert len(notifications) == 1

    def test_skips_if_already_exists(self) -> None:
        create_notification("aa:01", "test_check", "warning", "Test", "Test message")
        from app.services.anomaly_checker import AnomalyResult
        result = AnomalyResult(
            check_id="test_check",
            severity="warning",
            title="Test",
            message="Test message",
            device_mac="aa:01",
        )
        _create_notification_from_result(result)
        notifications = get_notifications()
        assert len(notifications) == 1


class TestMaybePrune:
    def setup_method(self) -> None:
        import app.services.poller as poller_mod
        poller_mod._last_prune_time = 0.0

    def test_prunes_on_first_call(self) -> None:
        with patch("app.services.poller.prune_old_data") as mock_prune:
            _maybe_prune()
        mock_prune.assert_called_once()

    def test_does_not_prune_within_interval(self) -> None:
        import app.services.poller as poller_mod
        poller_mod._last_prune_time = time.monotonic()
        with patch("app.services.poller.prune_old_data") as mock_prune:
            _maybe_prune()
        mock_prune.assert_not_called()

    def test_prunes_after_interval(self) -> None:
        import app.services.poller as poller_mod
        poller_mod._last_prune_time = time.monotonic() - _PRUNE_INTERVAL - 1
        with patch("app.services.poller.prune_old_data") as mock_prune:
            _maybe_prune()
        mock_prune.assert_called_once()


class TestStartMetricsPoller:
    @pytest.mark.anyio
    async def test_polls_when_credentials_available(self) -> None:
        mock_stats = [_make_stats()]
        mock_raw = [{"mac": "aa:bb:cc:dd:ee:01", "system-stats": {"cpu": 10, "mem": 30}}]

        with (
            patch("app.services.poller.has_credentials", return_value=True),
            patch("app.services.poller.get_unifi_config", return_value=MagicMock()),
            patch("app.services.poller.to_topology_config", return_value=MagicMock()),
            patch("app.services.poller.fetch_device_stats", return_value=mock_raw),
            patch("app.services.poller.normalize_device_stats", return_value=mock_stats),
            patch("app.services.poller.record_snapshot") as mock_record,
            patch("app.services.poller._check_anomalies") as mock_check,
            patch("app.services.poller._maybe_prune") as mock_prune,
            patch("asyncio.sleep", side_effect=asyncio.CancelledError),
            pytest.raises(asyncio.CancelledError),
        ):
            await start_metrics_poller()

        mock_record.assert_called_once_with(mock_stats)
        mock_check.assert_called_once_with(mock_stats)
        mock_prune.assert_called_once()

    @pytest.mark.anyio
    async def test_skips_when_no_credentials(self) -> None:
        with (
            patch("app.services.poller.has_credentials", return_value=False),
            patch("app.services.poller.record_snapshot") as mock_record,
            patch("asyncio.sleep", side_effect=asyncio.CancelledError),
            pytest.raises(asyncio.CancelledError),
        ):
            await start_metrics_poller()

        mock_record.assert_not_called()

    @pytest.mark.anyio
    async def test_handles_exception_gracefully(self) -> None:
        call_count = 0

        async def stop_after_one(*args: object) -> None:
            nonlocal call_count
            call_count += 1
            raise asyncio.CancelledError

        with (
            patch("app.services.poller.has_credentials", side_effect=RuntimeError("test error")),
            patch("asyncio.sleep", side_effect=stop_after_one),
            pytest.raises(asyncio.CancelledError),
        ):
            await start_metrics_poller()

        assert call_count == 1  # Loop continued past the exception
