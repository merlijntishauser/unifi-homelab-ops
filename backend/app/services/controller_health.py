"""Tracks the health of the connection to the UniFi controller.

The background poller updates this after each cycle and the auth-status endpoint
reads it, so the UI can distinguish "credentials configured" from "credentials
actually accepted by the controller".
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Literal

ControllerStatus = Literal["ok", "auth_error", "unreachable", "unknown"]


@dataclass(frozen=True)
class ControllerHealth:
    status: ControllerStatus
    detail: str


_state = ControllerHealth(status="unknown", detail="")
_lock = Lock()


def set_controller_health(status: ControllerStatus, detail: str = "") -> ControllerStatus:
    """Record the latest controller health and return the previous status."""
    global _state  # noqa: PLW0603
    with _lock:
        previous = _state.status
        _state = ControllerHealth(status=status, detail=detail)
    return previous


def get_controller_health() -> ControllerHealth:
    with _lock:
        return _state


def reset_controller_health() -> None:
    """Reset to 'unknown' (e.g. on logout or when credentials change)."""
    set_controller_health("unknown", "")
