"""Tests for cabling router endpoints."""

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials
from app.database import init_db_for_tests, reset_engine
from app.models import TopologyDevice, TopologyDevicesResponse, TopologyEdge

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


# ── Cable endpoints ──


async def test_list_cables_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/cables")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_cable(client: AsyncClient) -> None:
    resp = await client.post("/api/cables", json={
        "source_device_mac": "aa:bb",
        "source_port": 1,
        "cable_type": "cat6a",
        "label": "C-100",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "C-100"
    assert data["cable_type"] == "cat6a"
    assert data["source_device_mac"] == "aa:bb"
    assert data["source_port"] == 1


async def test_create_cable_auto_label(client: AsyncClient) -> None:
    resp = await client.post("/api/cables", json={})
    assert resp.status_code == 201
    assert resp.json()["label"] == "C-001"


async def test_create_cable_with_all_fields(client: AsyncClient) -> None:
    resp = await client.post("/api/cables", json={
        "source_device_mac": "aa:bb",
        "source_port": 1,
        "dest_device_mac": "cc:dd",
        "dest_port": 2,
        "dest_label": "Office 201",
        "cable_type": "cat6a",
        "length_m": 15.5,
        "color": "blue",
        "label": "C-050",
        "speed": 1000,
        "poe": True,
        "status": "active",
        "notes": "Main uplink",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["poe"] is True
    assert data["length_m"] == 15.5
    assert data["dest_label"] == "Office 201"


async def test_list_cables_after_create(client: AsyncClient) -> None:
    await client.post("/api/cables", json={"label": "C-001"})
    await client.post("/api/cables", json={"label": "C-002"})
    resp = await client.get("/api/cables")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_update_cable(client: AsyncClient) -> None:
    create_resp = await client.post("/api/cables", json={"label": "C-001"})
    cable_id = create_resp.json()["id"]
    resp = await client.put(f"/api/cables/{cable_id}", json={
        "label": "C-001-updated",
        "color": "red",
        "cable_type": "fiber-om3",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "C-001-updated"
    assert data["color"] == "red"
    assert data["cable_type"] == "fiber-om3"


async def test_update_cable_not_found(client: AsyncClient) -> None:
    resp = await client.put("/api/cables/9999", json={"label": "X"})
    assert resp.status_code == 404


async def test_delete_cable(client: AsyncClient) -> None:
    create_resp = await client.post("/api/cables", json={"label": "C-001"})
    cable_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/cables/{cable_id}")
    assert resp.status_code == 204
    get_resp = await client.get("/api/cables")
    assert len(get_resp.json()) == 0


async def test_delete_cable_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/api/cables/9999")
    assert resp.status_code == 404


async def test_sync_requires_credentials(client: AsyncClient) -> None:
    resp = await client.post("/api/cables/sync")
    assert resp.status_code == 401


async def test_sync_from_topology(client: AsyncClient) -> None:
    _login()
    mock_response = TopologyDevicesResponse(
        devices=[
            TopologyDevice(
                mac="aa:01", name="Gateway", model="UDM-Pro",
                model_name="Dream Machine Pro", type="gateway", ip="10.0.0.1", version="4.0",
            ),
            TopologyDevice(
                mac="aa:02", name="Switch", model="USW-24",
                model_name="Switch 24", type="switch", ip="10.0.0.2", version="7.1",
            ),
        ],
        edges=[
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=1, remote_port=1,
                speed=1000, poe=False, wireless=False,
            ),
        ],
    )
    with patch("app.services.topology.get_topology_devices", return_value=mock_response):
        resp = await client.post("/api/cables/sync")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["source_device_mac"] == "aa:01"
    assert data[0]["source_device_name"] == "Gateway"


# ── Patch Panel endpoints ──


async def test_list_panels_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/patch-panels")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_panel(client: AsyncClient) -> None:
    resp = await client.post("/api/patch-panels", json={"name": "PP-01"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "PP-01"
    assert data["port_count"] == 24
    assert data["panel_type"] == "keystone"
    assert data["rack_mounted"] is False
    assert data["assigned_ports"] == 0


async def test_create_panel_with_all_fields(client: AsyncClient) -> None:
    resp = await client.post("/api/patch-panels", json={
        "name": "PP-02",
        "port_count": 48,
        "panel_type": "fiber",
        "rack_mounted": True,
        "location": "Rack 2",
        "notes": "Bottom of rack",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["port_count"] == 48
    assert data["panel_type"] == "fiber"
    assert data["rack_mounted"] is True
    assert data["location"] == "Rack 2"


async def test_list_panels_after_create(client: AsyncClient) -> None:
    await client.post("/api/patch-panels", json={"name": "PP-01"})
    await client.post("/api/patch-panels", json={"name": "PP-02"})
    resp = await client.get("/api/patch-panels")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_update_panel(client: AsyncClient) -> None:
    create_resp = await client.post("/api/patch-panels", json={"name": "PP-01"})
    panel_id = create_resp.json()["id"]
    resp = await client.put(f"/api/patch-panels/{panel_id}", json={
        "name": "PP-01-updated",
        "port_count": 12,
        "panel_type": "fixed",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "PP-01-updated"
    assert data["port_count"] == 12


async def test_update_panel_not_found(client: AsyncClient) -> None:
    resp = await client.put("/api/patch-panels/9999", json={"name": "X"})
    assert resp.status_code == 404


async def test_delete_panel(client: AsyncClient) -> None:
    create_resp = await client.post("/api/patch-panels", json={"name": "PP-01"})
    panel_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/patch-panels/{panel_id}")
    assert resp.status_code == 204
    get_resp = await client.get("/api/patch-panels")
    assert len(get_resp.json()) == 0


async def test_delete_panel_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/api/patch-panels/9999")
    assert resp.status_code == 404


async def test_panel_assigned_ports_counted(client: AsyncClient) -> None:
    panel_resp = await client.post("/api/patch-panels", json={"name": "PP-01"})
    panel_id = panel_resp.json()["id"]
    await client.post("/api/cables", json={"patch_panel_id": panel_id, "patch_panel_port": 1, "label": "C-001"})
    await client.post("/api/cables", json={"patch_panel_id": panel_id, "patch_panel_port": 2, "label": "C-002"})
    resp = await client.get("/api/patch-panels")
    assert resp.json()[0]["assigned_ports"] == 2


# ── Label Settings endpoints ──


async def test_get_label_settings_defaults(client: AsyncClient) -> None:
    resp = await client.get("/api/settings/cable-labels")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "sequential"
    assert data["prefix"] == "C-"
    assert data["next_number"] == 1
    assert data["custom_pattern"] is None


async def test_update_label_settings(client: AsyncClient) -> None:
    resp = await client.put("/api/settings/cable-labels", json={
        "mode": "location",
        "prefix": "NET-",
        "next_number": 100,
        "custom_pattern": "{floor}-{room}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "location"
    assert data["prefix"] == "NET-"
    assert data["next_number"] == 100
    assert data["custom_pattern"] == "{floor}-{room}"


async def test_label_settings_persist(client: AsyncClient) -> None:
    await client.put("/api/settings/cable-labels", json={
        "mode": "custom",
        "prefix": "X-",
        "next_number": 50,
    })
    resp = await client.get("/api/settings/cable-labels")
    data = resp.json()
    assert data["prefix"] == "X-"
    assert data["next_number"] == 50
