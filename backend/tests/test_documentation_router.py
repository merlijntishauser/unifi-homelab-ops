"""Tests for documentation router endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials
from app.models import DocumentationSection

STUB_SECTIONS = [
    DocumentationSection(
        id="mermaid-topology",
        title="Network Topology",
        content="```mermaid\ngraph LR\n```",
        item_count=2,
    ),
    DocumentationSection(
        id="device-inventory",
        title="Device Inventory",
        content="| Name | Model |\n|------|-------|\n| USW | Switch |",
        item_count=1,
    ),
]

STUB_EXPORT = "# Network Documentation\n\n## Network Topology\n\n```mermaid\ngraph LR\n```\n"


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


@pytest.mark.anyio
async def test_sections_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/docs/sections")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_sections_returns_response(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.documentation.get_documentation_sections", return_value=STUB_SECTIONS):
        resp = await client.get("/api/docs/sections")
    assert resp.status_code == 200
    data = resp.json()
    assert "sections" in data
    assert len(data["sections"]) == 2
    assert data["sections"][0]["id"] == "mermaid-topology"
    assert data["sections"][0]["title"] == "Network Topology"
    assert data["sections"][0]["item_count"] == 2
    assert data["sections"][1]["id"] == "device-inventory"


@pytest.mark.anyio
async def test_export_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/docs/export")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_export_returns_markdown(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.documentation.get_documentation_export", return_value=STUB_EXPORT):
        resp = await client.get("/api/docs/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/markdown; charset=utf-8"
    assert resp.text == STUB_EXPORT
    assert "# Network Documentation" in resp.text
