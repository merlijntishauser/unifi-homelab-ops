"""Tests for rack planner router endpoints."""

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials
from app.database import init_db_for_tests, reset_engine
from app.models import TopologyDevice, TopologyDevicesResponse

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


async def test_list_racks_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/racks/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_rack(client: AsyncClient) -> None:
    resp = await client.post("/api/racks/", json={"name": "Main Rack", "height_u": 12})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Rack"
    assert data["height_u"] == 12
    assert data["size"] == "19-inch"
    assert data["items"] == []
    assert data["total_power"] == 0.0
    assert data["used_u"] == 0


async def test_create_rack_with_all_fields(client: AsyncClient) -> None:
    resp = await client.post("/api/racks/", json={
        "name": "Small Rack", "size": "10-inch", "height_u": 6, "location": "Closet",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["size"] == "10-inch"
    assert data["location"] == "Closet"


async def test_list_racks_after_create(client: AsyncClient) -> None:
    await client.post("/api/racks/", json={"name": "Rack A"})
    await client.post("/api/racks/", json={"name": "Rack B"})
    resp = await client.get("/api/racks/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_get_rack(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "My Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.get(f"/api/racks/{rack_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Rack"


async def test_get_rack_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/racks/9999")
    assert resp.status_code == 404


async def test_update_rack(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Old Name"})
    rack_id = create_resp.json()["id"]
    resp = await client.put(f"/api/racks/{rack_id}", json={"name": "New Name", "height_u": 24})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["height_u"] == 24


async def test_update_rack_not_found(client: AsyncClient) -> None:
    resp = await client.put("/api/racks/9999", json={"name": "X"})
    assert resp.status_code == 404


async def test_delete_rack(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "To Delete"})
    rack_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/racks/{rack_id}")
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/racks/{rack_id}")
    assert get_resp.status_code == 404


async def test_delete_rack_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/api/racks/9999")
    assert resp.status_code == 404


async def test_add_rack_item(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 1, "height_u": 2, "device_type": "switch",
        "label": "USW-24", "power_watts": 25.0, "notes": "Main switch",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "USW-24"
    assert data["height_u"] == 2
    assert data["power_watts"] == 25.0


async def test_add_rack_item_rack_not_found(client: AsyncClient) -> None:
    resp = await client.post("/api/racks/9999/items", json={"position_u": 1, "label": "X"})
    assert resp.status_code == 404


async def test_add_rack_item_overlap(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 1, "height_u": 2, "label": "First",
    })
    resp = await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 2, "label": "Second",
    })
    assert resp.status_code == 409


async def test_add_rack_item_exceeds_height(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack", "height_u": 4})
    rack_id = create_resp.json()["id"]
    resp = await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 4, "height_u": 2, "label": "Too Tall",
    })
    assert resp.status_code == 409


async def test_update_rack_item(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    item_resp = await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 1, "label": "Old",
    })
    item_id = item_resp.json()["id"]
    resp = await client.put(f"/api/racks/{rack_id}/items/{item_id}", json={
        "position_u": 1, "label": "Updated", "power_watts": 50.0,
    })
    assert resp.status_code == 200
    assert resp.json()["label"] == "Updated"


async def test_update_rack_item_not_found(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.put(f"/api/racks/{rack_id}/items/9999", json={
        "position_u": 1, "label": "X",
    })
    assert resp.status_code == 404


async def test_update_rack_item_overlap(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "First"})
    item_resp = await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 3, "label": "Second"})
    item_id = item_resp.json()["id"]
    resp = await client.put(f"/api/racks/{rack_id}/items/{item_id}", json={
        "position_u": 1, "label": "Second",
    })
    assert resp.status_code == 409


async def test_delete_rack_item(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    item_resp = await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "Item"})
    item_id = item_resp.json()["id"]
    resp = await client.delete(f"/api/racks/{rack_id}/items/{item_id}")
    assert resp.status_code == 204


async def test_delete_rack_item_not_found(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/racks/{rack_id}/items/9999")
    assert resp.status_code == 404


async def test_move_rack_item(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    item_resp = await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "Device"})
    item_id = item_resp.json()["id"]
    resp = await client.patch(f"/api/racks/{rack_id}/items/{item_id}/move", json={"position_u": 5})
    assert resp.status_code == 200
    assert resp.json()["position_u"] == 5


async def test_move_rack_item_overlap(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "First"})
    item_resp = await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 3, "label": "Second"})
    item_id = item_resp.json()["id"]
    resp = await client.patch(f"/api/racks/{rack_id}/items/{item_id}/move", json={"position_u": 1})
    assert resp.status_code == 409


async def test_move_rack_item_not_found(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.patch(f"/api/racks/{rack_id}/items/9999/move", json={"position_u": 1})
    assert resp.status_code == 404


async def test_get_bom(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack", "height_u": 6})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 1, "height_u": 2, "label": "Switch", "power_watts": 25.0,
    })
    resp = await client.get(f"/api/racks/{rack_id}/bom")
    assert resp.status_code == 200
    data = resp.json()
    assert data["rack_name"] == "Rack"
    assert len(data["entries"]) >= 2  # at least device + blanking plates


async def test_get_bom_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/racks/9999/bom")
    assert resp.status_code == 404


async def test_import_requires_credentials(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    resp = await client.post(f"/api/racks/{rack_id}/import")
    assert resp.status_code == 401


async def test_import_from_topology(client: AsyncClient) -> None:
    _login()
    create_resp = await client.post("/api/racks/", json={"name": "Rack", "height_u": 12})
    rack_id = create_resp.json()["id"]

    mock_response = TopologyDevicesResponse(
        devices=[
            TopologyDevice(
                mac="aa:01", name="Gateway", model="UDM-Pro",
                model_name="Dream Machine Pro", type="gateway", ip="192.168.1.1", version="4.0.6",
            ),
            TopologyDevice(
                mac="aa:02", name="Switch", model="USW-24",
                model_name="Switch 24", type="switch", ip="192.168.1.2", version="7.1.0",
            ),
        ],
        edges=[],
    )
    with patch("app.services.topology.get_topology_devices", return_value=mock_response):
        resp = await client.post(f"/api/racks/{rack_id}/import")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


async def test_import_rack_not_found(client: AsyncClient) -> None:
    _login()
    with patch("app.services.topology.get_topology_devices"):
        resp = await client.post("/api/racks/9999/import")
    assert resp.status_code == 404


async def test_rack_items_appear_in_get_rack(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "Switch"})
    await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 2, "label": "Panel"})
    resp = await client.get(f"/api/racks/{rack_id}")
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["used_u"] == 2
    assert data["total_power"] == 0.0


async def test_rack_summary_stats(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={
        "position_u": 1, "height_u": 2, "label": "Switch", "power_watts": 30.0,
    })
    resp = await client.get("/api/racks/")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["item_count"] == 1
    assert data[0]["used_u"] == 2
    assert data[0]["total_power"] == 30.0


async def test_delete_rack_cascades_items(client: AsyncClient) -> None:
    create_resp = await client.post("/api/racks/", json={"name": "Rack"})
    rack_id = create_resp.json()["id"]
    await client.post(f"/api/racks/{rack_id}/items", json={"position_u": 1, "label": "Item"})
    resp = await client.delete(f"/api/racks/{rack_id}")
    assert resp.status_code == 204
    # Verify the rack is gone
    get_resp = await client.get(f"/api/racks/{rack_id}")
    assert get_resp.status_code == 404
