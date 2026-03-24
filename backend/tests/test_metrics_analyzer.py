"""Tests for the device metrics AI analyzer."""

from unittest.mock import patch

import pytest

from app.models import MetricsHistoryPoint, MetricsSnapshot
from app.services.metrics_analyzer import _build_user_prompt, analyze_device


def _make_device(**overrides: object) -> MetricsSnapshot:
    defaults = dict(
        mac="aa:bb:cc:dd:ee:01",
        name="Gateway",
        model="UDM-Pro",
        type="gateway",
        cpu=25.0,
        mem=60.0,
        temperature=52.0,
        uptime=90061,
        tx_bytes=1048576,
        rx_bytes=2097152,
        num_sta=5,
        version="4.0.6",
        poe_consumption=None,
        poe_budget=None,
        ip="192.168.1.1",
        status="online",
    )
    defaults.update(overrides)
    return MetricsSnapshot(**defaults)  # type: ignore[arg-type]


def _make_history(count: int) -> list[MetricsHistoryPoint]:
    return [
        MetricsHistoryPoint(
            timestamp=f"2026-01-01T{i:02d}:00:00Z",
            cpu=20.0 + i,
            mem=50.0 + i,
            temperature=45.0 + i * 0.5,
            uptime=86400 + i * 3600,
            tx_bytes=1000 * (i + 1),
            rx_bytes=2000 * (i + 1),
            num_sta=5,
            poe_consumption=None,
        )
        for i in range(count)
    ]


class TestBuildUserPrompt:
    def test_includes_device_info(self) -> None:
        prompt = _build_user_prompt(_make_device(), [])
        assert "Gateway" in prompt
        assert "UDM-Pro" in prompt
        assert "CPU 25.0%" in prompt

    def test_includes_temperature_when_present(self) -> None:
        prompt = _build_user_prompt(_make_device(temperature=55.0), [])
        assert "Temperature: 55.0C" in prompt

    def test_excludes_temperature_when_none(self) -> None:
        prompt = _build_user_prompt(_make_device(temperature=None), [])
        assert "Temperature" not in prompt

    def test_includes_poe_when_present(self) -> None:
        prompt = _build_user_prompt(_make_device(poe_consumption=45.0, poe_budget=100.0), [])
        assert "PoE: 45.0W / 100W budget" in prompt

    def test_includes_history_stats(self) -> None:
        history = _make_history(5)
        prompt = _build_user_prompt(_make_device(), history)
        assert "24h CPU:" in prompt
        assert "24h Mem:" in prompt
        assert "24h Traffic:" in prompt

    def test_includes_timeline_samples(self) -> None:
        history = _make_history(20)
        prompt = _build_user_prompt(_make_device(), history)
        assert "Timeline samples" in prompt


class TestBuildUserPromptEdgeCases:
    def test_history_without_temperature(self) -> None:
        """When history points have temperature=None, temp stats are skipped."""
        history = [
            MetricsHistoryPoint(
                timestamp="2026-01-01T00:00:00Z",
                cpu=20.0,
                mem=50.0,
                temperature=None,
                uptime=86400,
                tx_bytes=1000,
                rx_bytes=2000,
                num_sta=5,
            ),
            MetricsHistoryPoint(
                timestamp="2026-01-01T01:00:00Z",
                cpu=25.0,
                mem=55.0,
                temperature=None,
                uptime=90000,
                tx_bytes=2000,
                rx_bytes=4000,
                num_sta=6,
            ),
        ]
        prompt = _build_user_prompt(_make_device(), history)
        assert "24h CPU:" in prompt
        assert "24h Temp:" not in prompt
        assert "24h Traffic:" in prompt

    def test_single_history_point_skips_traffic(self) -> None:
        """With only 1 history point, traffic delta cannot be computed."""
        history = [
            MetricsHistoryPoint(
                timestamp="2026-01-01T00:00:00Z",
                cpu=20.0,
                mem=50.0,
                temperature=None,
                uptime=86400,
                tx_bytes=1000,
                rx_bytes=2000,
                num_sta=5,
            ),
        ]
        prompt = _build_user_prompt(_make_device(), history)
        assert "24h CPU:" in prompt
        assert "24h Traffic:" not in prompt
        assert "24h Clients:" in prompt


class TestAnalyzeDevice:
    def test_calls_openai_provider(self) -> None:
        config = {"provider_type": "openai", "base_url": "https://api.openai.com/v1", "api_key": "sk-test", "model": "gpt-4o-mini"}
        with patch("app.services.metrics_analyzer.call_openai", return_value="All looks healthy.") as mock:
            result = analyze_device(_make_device(), _make_history(3), config)
        assert result == "All looks healthy."
        mock.assert_called_once()

    def test_calls_anthropic_provider(self) -> None:
        config = {"provider_type": "anthropic", "base_url": "https://api.anthropic.com/v1", "api_key": "sk-ant-test", "model": "claude-sonnet-4-20250514"}
        with patch("app.services.metrics_analyzer.call_anthropic", return_value="Memory is high.") as mock:
            result = analyze_device(_make_device(), _make_history(3), config)
        assert result == "Memory is high."
        mock.assert_called_once()

    def test_defaults_to_openai_for_unknown_provider(self) -> None:
        config = {"provider_type": "unknown", "base_url": "https://example.com", "api_key": "key", "model": "model"}
        with patch("app.services.metrics_analyzer.call_openai", return_value="ok") as mock:
            analyze_device(_make_device(), [], config)
        mock.assert_called_once()


class TestAnalyzeEndpoint:
    @pytest.fixture()
    def client(self):
        from httpx import ASGITransport, AsyncClient

        from app.main import app

        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    @pytest.mark.anyio
    async def test_returns_400_when_ai_not_configured(self, client) -> None:  # type: ignore[no-untyped-def]
        with (
            patch("app.routers.metrics._fetch_live_stats", return_value=([], {})),
            patch("app.services.ai_settings.get_full_ai_config", return_value=None),
        ):
            resp = await client.post("/api/metrics/devices/aa:bb:cc/analyze")
        assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_returns_404_when_no_history(self, client) -> None:  # type: ignore[no-untyped-def]
        with (
            patch("app.routers.metrics._fetch_live_stats", return_value=([], {})),
            patch("app.services.ai_settings.get_full_ai_config", return_value={"base_url": "x", "api_key": "k", "model": "m", "provider_type": "openai"}),
            patch("app.routers.metrics.get_device_history", return_value=[]),
        ):
            resp = await client.post("/api/metrics/devices/aa:bb:cc/analyze")
        assert resp.status_code == 404
