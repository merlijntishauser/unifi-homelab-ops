"""Tests for the snoozed devices service."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.database import init_db_for_tests, reset_engine
from app.models import SnoozeInput
from app.services.metrics import create_notification, get_notifications
from app.services.snoozed_devices import (
    get_snoozed,
    get_snoozed_macs,
    reconcile_online,
    snooze_devices,
    unsnooze_device,
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


def test_snooze_and_list() -> None:
    snooze_devices([SnoozeInput(mac="AA:BB:CC", name="Switch", model="USW")])
    rows = get_snoozed()
    assert len(rows) == 1
    assert rows[0].mac == "aa:bb:cc"  # stored lowercased
    assert rows[0].name == "Switch"
    assert rows[0].snoozed_at  # non-empty timestamp
    assert get_snoozed_macs() == {"aa:bb:cc"}


def test_snooze_is_idempotent() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="First", model="m")])
    snooze_devices([SnoozeInput(mac="AA:BB", name="Second", model="m")])
    rows = get_snoozed()
    assert len(rows) == 1
    assert rows[0].name == "First"  # original kept


def test_snooze_resolves_active_notifications() -> None:
    create_notification("aa:bb", "high_cpu", "warning", "CPU", "high")
    snooze_devices([SnoozeInput(mac="AA:BB", name="x", model="y")])
    active = get_notifications(include_resolved=False)
    assert all(n.device_mac != "aa:bb" for n in active)


def test_unsnooze_removes_device() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    unsnooze_device("AA:BB")
    assert get_snoozed_macs() == set()


def test_unsnooze_missing_is_noop() -> None:
    unsnooze_device("zz:zz")  # should not raise
    assert get_snoozed_macs() == set()


def test_reconcile_online_unsnoozes_reconnected() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    snooze_devices([SnoozeInput(mac="cc:dd", name="x", model="y")])
    reenabled = reconcile_online({"AA:BB"})
    assert reenabled == ["aa:bb"]
    assert get_snoozed_macs() == {"cc:dd"}


def test_reconcile_online_no_matches() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    assert reconcile_online({"ee:ff"}) == []
    assert get_snoozed_macs() == {"aa:bb"}
