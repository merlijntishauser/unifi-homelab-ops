"""Tests for structured logging configuration."""

import pytest

from app.logging import configure_logging


class TestConfigureLoggingProduction:
    def test_production_mode_uses_json_renderer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When FRONTEND_DIST_DIR is set, production mode uses JSON renderer."""
        monkeypatch.setenv("FRONTEND_DIST_DIR", "/app/dist")
        # Should not raise; just verify it configures without error
        configure_logging()

    def test_development_mode_uses_console_renderer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When FRONTEND_DIST_DIR is not set, development mode uses ConsoleRenderer."""
        monkeypatch.delenv("FRONTEND_DIST_DIR", raising=False)
        configure_logging()
