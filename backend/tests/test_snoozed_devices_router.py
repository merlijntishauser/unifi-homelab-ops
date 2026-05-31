"""Tests for the snoozed devices router."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db_for_tests, reset_engine


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


@pytest.mark.anyio
async def test_list_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/devices/snoozed")
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}


@pytest.mark.anyio
async def test_snooze_then_list(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/devices/snoozed",
        json={"devices": [{"mac": "AA:BB", "name": "Switch", "model": "USW"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["devices"]) == 1
    assert data["devices"][0]["mac"] == "aa:bb"
    assert data["devices"][0]["name"] == "Switch"


@pytest.mark.anyio
async def test_unsnooze(client: AsyncClient) -> None:
    await client.post(
        "/api/devices/snoozed",
        json={"devices": [{"mac": "aa:bb", "name": "x", "model": "y"}]},
    )
    resp = await client.request("DELETE", "/api/devices/snoozed/AA:BB")
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}
