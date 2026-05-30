"""Tests for the controller health tracker."""

from app.services.controller_health import (
    get_controller_health,
    reset_controller_health,
    set_controller_health,
)


def test_defaults_to_unknown_after_reset() -> None:
    reset_controller_health()
    health = get_controller_health()
    assert health.status == "unknown"
    assert health.detail == ""


def test_set_returns_previous_status() -> None:
    reset_controller_health()
    previous = set_controller_health("ok")
    assert previous == "unknown"
    previous = set_controller_health("auth_error", "rejected")
    assert previous == "ok"
    health = get_controller_health()
    assert health.status == "auth_error"
    assert health.detail == "rejected"


def test_reset_clears_detail() -> None:
    set_controller_health("auth_error", "bad key")
    reset_controller_health()
    health = get_controller_health()
    assert health.status == "unknown"
    assert health.detail == ""
