"""Tests for app startup (lifespan)."""

import logging
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.main import (
    HealthcheckAccessFilter,
    _configure_access_log_filters,
    _get_app_access_url,
    _is_enabled,
    _is_healthcheck_access_log,
    _log_startup_banner,
    lifespan,
)


@pytest.mark.anyio
async def test_lifespan_calls_init_db() -> None:
    test_app = FastAPI()
    with patch("app.main.init_db") as mock_init:
        async with lifespan(test_app):
            mock_init.assert_called_once()


def test_is_enabled_recognizes_truthy_values() -> None:
    assert _is_enabled("true") is True
    assert _is_enabled("1") is True
    assert _is_enabled("yes") is True
    assert _is_enabled("on") is True
    assert _is_enabled("false") is False
    assert _is_enabled(None) is False


def test_healthcheck_filter_matches_uvicorn_health_log() -> None:
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("127.0.0.1:12345", "GET", "/api/health", "1.1", 200),
        exc_info=None,
    )

    assert _is_healthcheck_access_log(record) is True
    assert HealthcheckAccessFilter().filter(record) is False


def test_healthcheck_filter_allows_other_access_logs() -> None:
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("127.0.0.1:12345", "GET", "/api/zones", "1.1", 200),
        exc_info=None,
    )

    assert _is_healthcheck_access_log(record) is False
    assert HealthcheckAccessFilter().filter(record) is True


def test_get_app_access_url_defaults_to_localhost(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_ACCESS_URL", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    assert _get_app_access_url() == "http://localhost:8080"


def test_get_app_access_url_uses_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ACCESS_URL", "http://localhost:8081/")

    assert _get_app_access_url() == "http://localhost:8081"


def test_configure_access_log_filters_only_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    access_logger = logging.getLogger("uvicorn.access")
    original_filters = list(access_logger.filters)
    access_logger.filters.clear()

    try:
        monkeypatch.delenv("SUPPRESS_HEALTHCHECK_ACCESS_LOGS", raising=False)
        _configure_access_log_filters()
        assert access_logger.filters == []

        monkeypatch.setenv("SUPPRESS_HEALTHCHECK_ACCESS_LOGS", "true")
        _configure_access_log_filters()
        assert len(access_logger.filters) == 1
        assert isinstance(access_logger.filters[0], HealthcheckAccessFilter)

        _configure_access_log_filters()
        assert len(access_logger.filters) == 1
    finally:
        access_logger.filters.clear()
        access_logger.filters.extend(original_filters)


def test_log_startup_banner_logs_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SHOW_STARTUP_BANNER", "true")
    monkeypatch.setenv("APP_ACCESS_URL", "http://localhost:8081")

    with patch("app.main.startup_logger.info") as mock_info:
        _log_startup_banner()

    logged_lines = [call.args[0] for call in mock_info.call_args_list]
    assert any("UniFi Firewall Analyser" in line for line in logged_lines)
    assert any("http://localhost:8081" in line for line in logged_lines)
    assert any("/api/health" in line for line in logged_lines)


def test_log_startup_banner_does_not_log_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SHOW_STARTUP_BANNER", raising=False)

    with patch("app.main.startup_logger.info") as mock_info:
        _log_startup_banner()

    mock_info.assert_not_called()


@pytest.mark.anyio
async def test_root_returns_404_without_frontend_dist(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(tmp_path / "missing"))

    response = await client.get("/")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_serves_index_for_spa_routes(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/zone/internal")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "UniFi Firewall Analyser" in response.text


@pytest.mark.anyio
async def test_serves_existing_static_assets(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok');", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/assets/app.js")

    assert response.status_code == 200
    assert "console.log('ok');" in response.text


@pytest.mark.anyio
async def test_missing_static_assets_return_404(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/assets/missing.js")

    assert response.status_code == 404
