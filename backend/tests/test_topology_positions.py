"""Tests for topology node position persistence."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db_for_tests, reset_engine
from app.models import NodePosition
from app.services.topology_positions import delete_all_positions, get_node_positions, save_node_positions

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


class TestTopologyPositionsService:
    def test_empty_by_default(self) -> None:
        assert get_node_positions() == []

    def test_save_and_get(self) -> None:
        save_node_positions([NodePosition(mac="aa:01", x=100.0, y=200.0)])
        result = get_node_positions()
        assert len(result) == 1
        assert result[0].mac == "aa:01"
        assert result[0].x == 100.0
        assert result[0].y == 200.0

    def test_save_upserts_existing(self) -> None:
        save_node_positions([NodePosition(mac="aa:01", x=100.0, y=200.0)])
        save_node_positions([NodePosition(mac="aa:01", x=300.0, y=400.0)])
        result = get_node_positions()
        assert len(result) == 1
        assert result[0].x == 300.0
        assert result[0].y == 400.0

    def test_save_multiple(self) -> None:
        save_node_positions([
            NodePosition(mac="aa:01", x=10.0, y=20.0),
            NodePosition(mac="aa:02", x=30.0, y=40.0),
        ])
        result = get_node_positions()
        assert len(result) == 2

    def test_delete_all(self) -> None:
        save_node_positions([NodePosition(mac="aa:01", x=10.0, y=20.0)])
        delete_all_positions()
        assert get_node_positions() == []

    def test_save_after_delete(self) -> None:
        save_node_positions([NodePosition(mac="aa:01", x=10.0, y=20.0)])
        delete_all_positions()
        save_node_positions([NodePosition(mac="aa:02", x=50.0, y=60.0)])
        result = get_node_positions()
        assert len(result) == 1
        assert result[0].mac == "aa:02"


class TestTopologyPositionsRouter:
    async def test_get_empty(self, client: AsyncClient) -> None:
        resp = await client.get("/api/topology/positions")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_save_and_get(self, client: AsyncClient) -> None:
        resp = await client.put("/api/topology/positions", json={
            "positions": [{"mac": "aa:01", "x": 100.0, "y": 200.0}],
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

        resp = await client.get("/api/topology/positions")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["mac"] == "aa:01"

    async def test_delete(self, client: AsyncClient) -> None:
        await client.put("/api/topology/positions", json={
            "positions": [{"mac": "aa:01", "x": 10.0, "y": 20.0}],
        })
        resp = await client.delete("/api/topology/positions")
        assert resp.status_code == 204

        resp = await client.get("/api/topology/positions")
        assert resp.json() == []

    async def test_save_empty_list(self, client: AsyncClient) -> None:
        resp = await client.put("/api/topology/positions", json={"positions": []})
        assert resp.status_code == 200
