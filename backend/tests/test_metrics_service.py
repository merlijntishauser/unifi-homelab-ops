"""Tests for metrics service."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from unifi_topology import DeviceStats

from app.database import init_db_for_tests, reset_engine
from app.services.metrics import (
    create_notification,
    dismiss_notification,
    get_device_history,
    get_latest_snapshots,
    get_notifications,
    prune_old_data,
    record_snapshot,
    resolve_notifications,
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


def _make_device_stats(
    mac: str = "aa:bb:cc:dd:ee:01",
    name: str = "Switch",
    model: str = "USW-24",
    device_type: str = "switch",
    cpu: float = 10.0,
    mem: float = 30.0,
    uptime: int = 86400,
    version: str = "7.1.0",
) -> DeviceStats:
    return DeviceStats(
        mac=mac,
        name=name,
        model=model,
        type=device_type,
        cpu=cpu,
        mem=mem,
        uptime=uptime,
        version=version,
    )


class TestRecordSnapshot:
    def test_records_single_device(self) -> None:
        stats = [_make_device_stats()]
        record_snapshot(stats)
        history = get_device_history("aa:bb:cc:dd:ee:01", hours=1)
        assert len(history) == 1
        assert history[0].cpu == 10.0
        assert history[0].mem == 30.0

    def test_records_multiple_devices(self) -> None:
        stats = [
            _make_device_stats(mac="aa:01"),
            _make_device_stats(mac="aa:02"),
        ]
        record_snapshot(stats)
        h1 = get_device_history("aa:01", hours=1)
        h2 = get_device_history("aa:02", hours=1)
        assert len(h1) == 1
        assert len(h2) == 1

    def test_records_multiple_snapshots(self) -> None:
        stats = [_make_device_stats()]
        record_snapshot(stats)
        record_snapshot(stats)
        history = get_device_history("aa:bb:cc:dd:ee:01", hours=1)
        assert len(history) == 2


class TestGetLatestSnapshots:
    def test_returns_latest_per_device(self) -> None:
        record_snapshot([_make_device_stats(cpu=10.0)])
        record_snapshot([_make_device_stats(cpu=20.0)])
        snapshots = get_latest_snapshots()
        assert len(snapshots) == 1
        assert snapshots[0].cpu == 20.0

    def test_returns_empty_when_no_data(self) -> None:
        snapshots = get_latest_snapshots()
        assert snapshots == []

    def test_enriches_with_live_stats(self) -> None:
        record_snapshot([_make_device_stats()])
        live = [_make_device_stats(name="Live Switch", version="8.0.0")]
        snapshots = get_latest_snapshots(current_stats=live)
        assert len(snapshots) == 1
        assert snapshots[0].name == "Live Switch"
        assert snapshots[0].version == "8.0.0"
        assert snapshots[0].status == "online"

    def test_unknown_status_without_live_stats(self) -> None:
        record_snapshot([_make_device_stats()])
        snapshots = get_latest_snapshots()
        assert snapshots[0].status == "unknown"

    def test_multiple_devices_latest(self) -> None:
        record_snapshot([_make_device_stats(mac="aa:01", cpu=10.0)])
        record_snapshot([_make_device_stats(mac="aa:02", cpu=20.0)])
        record_snapshot([_make_device_stats(mac="aa:01", cpu=30.0)])
        snapshots = get_latest_snapshots()
        assert len(snapshots) == 2
        by_mac = {s.mac: s for s in snapshots}
        assert by_mac["aa:01"].cpu == 30.0
        assert by_mac["aa:02"].cpu == 20.0


class TestGetDeviceHistory:
    def test_returns_history_ordered(self) -> None:
        stats = [_make_device_stats()]
        record_snapshot(stats)
        record_snapshot(stats)
        history = get_device_history("aa:bb:cc:dd:ee:01", hours=1)
        assert len(history) == 2
        assert history[0].timestamp <= history[1].timestamp

    def test_returns_empty_for_unknown_mac(self) -> None:
        history = get_device_history("unknown:mac", hours=1)
        assert history == []


class TestNotifications:
    def test_create_and_get(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        notifications = get_notifications()
        assert len(notifications) == 1
        assert notifications[0].device_mac == "aa:01"
        assert notifications[0].check_id == "high_cpu"
        assert notifications[0].severity == "warning"
        assert notifications[0].dismissed is False

    def test_dismiss_notification(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        notifications = get_notifications()
        assert len(notifications) == 1
        dismiss_notification(notifications[0].id)
        updated = get_notifications()
        assert len(updated) == 0

    def test_dismiss_nonexistent_does_not_raise(self) -> None:
        dismiss_notification(9999)  # Should not raise

    def test_get_notifications_excludes_resolved(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        resolve_notifications("aa:01", "high_cpu")
        active = get_notifications(include_resolved=False)
        assert len(active) == 0
        all_notifs = get_notifications(include_resolved=True)
        assert len(all_notifs) == 1

    def test_get_notifications_excludes_dismissed(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        notifications = get_notifications()
        dismiss_notification(notifications[0].id)
        active = get_notifications(include_resolved=False)
        assert len(active) == 0

    def test_resolve_notifications(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        resolve_notifications("aa:01", "high_cpu")
        notifications = get_notifications()
        assert notifications[0].resolved_at is not None

    def test_resolve_only_matching(self) -> None:
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        create_notification("aa:01", "high_memory", "warning", "High Memory", "Memory is high")
        resolve_notifications("aa:01", "high_cpu")
        notifications = get_notifications()
        by_check = {n.check_id: n for n in notifications}
        assert by_check["high_cpu"].resolved_at is not None
        assert by_check["high_memory"].resolved_at is None

    def test_resolve_no_match_does_not_raise(self) -> None:
        resolve_notifications("unknown", "unknown")  # Should not raise

    def test_notifications_ordered_by_created_at(self) -> None:
        create_notification("aa:01", "check1", "warning", "First", "First")
        create_notification("aa:02", "check2", "warning", "Second", "Second")
        notifications = get_notifications()
        assert len(notifications) == 2


class TestPruneOldData:
    def test_prune_keeps_recent_data(self) -> None:
        record_snapshot([_make_device_stats()])
        create_notification("aa:01", "high_cpu", "warning", "High CPU", "CPU is high")
        prune_old_data(hours=24)
        history = get_device_history("aa:bb:cc:dd:ee:01", hours=24)
        assert len(history) == 1
        notifications = get_notifications()
        assert len(notifications) == 1

    def test_prune_does_not_raise_on_empty_db(self) -> None:
        prune_old_data(hours=24)  # Should not raise
