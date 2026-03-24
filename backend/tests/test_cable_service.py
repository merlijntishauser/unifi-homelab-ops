"""Tests for cable service."""

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest

from app.config import UnifiCredentials
from app.database import init_db_for_tests, reset_engine
from app.models import (
    CableLabelSettings,
    CableRunInput,
    PatchPanelInput,
    TopologyDevice,
    TopologyDevicesResponse,
    TopologyEdge,
)
from app.services.cable_service import (
    _generate_label,
    _infer_cable_type,
    create_cable,
    create_patch_panel,
    delete_cable,
    delete_patch_panel,
    get_cable,
    get_label_settings,
    get_patch_panel,
    list_cables,
    list_patch_panels,
    save_label_settings,
    sync_from_topology,
    update_cable,
    update_patch_panel,
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


MOCK_CREDENTIALS = UnifiCredentials(
    url="https://unifi.example.com",
    username="admin",
    password="secret",
)


class TestListCables:
    def test_empty_list(self) -> None:
        assert list_cables() == []

    def test_lists_created_cables(self) -> None:
        create_cable(CableRunInput(label="C-001", cable_type="cat6"))
        create_cable(CableRunInput(label="C-002", cable_type="cat6a"))
        result = list_cables()
        assert len(result) == 2
        labels = {c.label for c in result}
        assert labels == {"C-001", "C-002"}

    def test_enriches_with_device_names(self) -> None:
        create_cable(CableRunInput(source_device_mac="aa:bb", dest_device_mac="cc:dd", label="C-001"))
        result = list_cables(device_names={"aa:bb": "Switch A", "cc:dd": "Switch B"})
        assert result[0].source_device_name == "Switch A"
        assert result[0].dest_device_name == "Switch B"

    def test_enriches_with_panel_name(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        create_cable(CableRunInput(patch_panel_id=panel.id, patch_panel_port=5, label="C-001"))
        result = list_cables()
        assert result[0].patch_panel_name == "PP-01"


class TestGetCable:
    def test_returns_cable(self) -> None:
        cable = create_cable(CableRunInput(label="C-001", cable_type="cat6a"))
        result = get_cable(cable.id)
        assert result.label == "C-001"
        assert result.cable_type == "cat6a"

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Cable 9999 not found"):
            get_cable(9999)

    def test_enriches_with_device_names(self) -> None:
        cable = create_cable(CableRunInput(source_device_mac="aa:bb", label="C-001"))
        result = get_cable(cable.id, device_names={"aa:bb": "Gateway"})
        assert result.source_device_name == "Gateway"


class TestCreateCable:
    def test_creates_with_all_fields(self) -> None:
        cable = create_cable(CableRunInput(
            source_device_mac="aa:bb",
            source_port=1,
            dest_device_mac="cc:dd",
            dest_port=2,
            dest_label="Office 201",
            cable_type="cat6a",
            length_m=15.5,
            color="blue",
            label="C-100",
            speed=1000,
            poe=True,
            status="active",
            notes="Main uplink",
        ))
        assert cable.source_device_mac == "aa:bb"
        assert cable.source_port == 1
        assert cable.dest_device_mac == "cc:dd"
        assert cable.dest_port == 2
        assert cable.dest_label == "Office 201"
        assert cable.cable_type == "cat6a"
        assert cable.length_m == 15.5
        assert cable.color == "blue"
        assert cable.label == "C-100"
        assert cable.speed == 1000
        assert cable.poe is True
        assert cable.status == "active"
        assert cable.notes == "Main uplink"

    def test_auto_generates_label_when_empty(self) -> None:
        cable = create_cable(CableRunInput())
        assert cable.label == "C-001"

    def test_auto_generates_sequential_labels(self) -> None:
        c1 = create_cable(CableRunInput())
        c2 = create_cable(CableRunInput())
        c3 = create_cable(CableRunInput())
        assert c1.label == "C-001"
        assert c2.label == "C-002"
        assert c3.label == "C-003"

    def test_preserves_explicit_label(self) -> None:
        cable = create_cable(CableRunInput(label="CUSTOM-42"))
        assert cable.label == "CUSTOM-42"

    def test_creates_with_patch_panel(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        cable = create_cable(CableRunInput(patch_panel_id=panel.id, patch_panel_port=12, label="C-001"))
        assert cable.patch_panel_id == panel.id
        assert cable.patch_panel_port == 12
        assert cable.patch_panel_name == "PP-01"

    def test_defaults(self) -> None:
        cable = create_cable(CableRunInput(label="C-001"))
        assert cable.cable_type == "cat6"
        assert cable.poe is False
        assert cable.status == "active"
        assert cable.color == ""
        assert cable.notes == ""
        assert cable.length_m is None
        assert cable.speed is None


class TestUpdateCable:
    def test_updates_all_fields(self) -> None:
        cable = create_cable(CableRunInput(label="C-001"))
        updated = update_cable(cable.id, CableRunInput(
            source_device_mac="11:22",
            source_port=3,
            dest_device_mac="33:44",
            dest_port=4,
            dest_label="Server Room",
            cable_type="fiber-om3",
            length_m=50.0,
            color="yellow",
            label="C-001-updated",
            speed=10000,
            poe=True,
            status="faulty",
            notes="Replace soon",
        ))
        assert updated.source_device_mac == "11:22"
        assert updated.source_port == 3
        assert updated.dest_device_mac == "33:44"
        assert updated.dest_port == 4
        assert updated.dest_label == "Server Room"
        assert updated.cable_type == "fiber-om3"
        assert updated.length_m == 50.0
        assert updated.color == "yellow"
        assert updated.label == "C-001-updated"
        assert updated.speed == 10000
        assert updated.poe is True
        assert updated.status == "faulty"
        assert updated.notes == "Replace soon"

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Cable 9999 not found"):
            update_cable(9999, CableRunInput(label="X"))


class TestDeleteCable:
    def test_deletes_cable(self) -> None:
        cable = create_cable(CableRunInput(label="C-001"))
        delete_cable(cable.id)
        with pytest.raises(ValueError, match="Cable .* not found"):
            get_cable(cable.id)

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Cable 9999 not found"):
            delete_cable(9999)


class TestListPatchPanels:
    def test_empty_list(self) -> None:
        assert list_patch_panels() == []

    def test_lists_created_panels(self) -> None:
        create_patch_panel(PatchPanelInput(name="PP-01"))
        create_patch_panel(PatchPanelInput(name="PP-02"))
        result = list_patch_panels()
        assert len(result) == 2
        names = {p.name for p in result}
        assert names == {"PP-01", "PP-02"}

    def test_assigned_ports_counted(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        create_cable(CableRunInput(patch_panel_id=panel.id, patch_panel_port=1, label="C-001"))
        create_cable(CableRunInput(patch_panel_id=panel.id, patch_panel_port=2, label="C-002"))
        create_cable(CableRunInput(label="C-003"))  # no panel
        result = list_patch_panels()
        assert result[0].assigned_ports == 2


class TestGetPatchPanel:
    def test_returns_panel(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01", port_count=48))
        result = get_patch_panel(panel.id)
        assert result.name == "PP-01"
        assert result.port_count == 48

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Patch panel 9999 not found"):
            get_patch_panel(9999)


class TestCreatePatchPanel:
    def test_creates_with_all_fields(self) -> None:
        panel = create_patch_panel(PatchPanelInput(
            name="PP-01",
            port_count=48,
            panel_type="fiber",
            rack_mounted=True,
            location="Rack 1",
            notes="Top of rack",
        ))
        assert panel.name == "PP-01"
        assert panel.port_count == 48
        assert panel.panel_type == "fiber"
        assert panel.rack_mounted is True
        assert panel.location == "Rack 1"
        assert panel.notes == "Top of rack"

    def test_defaults(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        assert panel.port_count == 24
        assert panel.panel_type == "keystone"
        assert panel.rack_mounted is False
        assert panel.rack_item_id is None
        assert panel.location == ""
        assert panel.notes == ""
        assert panel.assigned_ports == 0


class TestUpdatePatchPanel:
    def test_updates_all_fields(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        updated = update_patch_panel(panel.id, PatchPanelInput(
            name="PP-01-updated",
            port_count=12,
            panel_type="fixed",
            rack_mounted=True,
            location="Wall",
            notes="Updated",
        ))
        assert updated.name == "PP-01-updated"
        assert updated.port_count == 12
        assert updated.panel_type == "fixed"
        assert updated.rack_mounted is True
        assert updated.location == "Wall"
        assert updated.notes == "Updated"

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Patch panel 9999 not found"):
            update_patch_panel(9999, PatchPanelInput(name="X"))


class TestDeletePatchPanel:
    def test_deletes_panel(self) -> None:
        panel = create_patch_panel(PatchPanelInput(name="PP-01"))
        delete_patch_panel(panel.id)
        with pytest.raises(ValueError, match="Patch panel .* not found"):
            get_patch_panel(panel.id)

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="Patch panel 9999 not found"):
            delete_patch_panel(9999)


class TestLabelSettings:
    def test_get_defaults(self) -> None:
        settings = get_label_settings()
        assert settings.mode == "sequential"
        assert settings.prefix == "C-"
        assert settings.next_number == 1
        assert settings.custom_pattern is None

    def test_save_and_get(self) -> None:
        save_label_settings(CableLabelSettings(
            mode="location",
            prefix="NET-",
            next_number=100,
            custom_pattern="{floor}-{room}",
        ))
        settings = get_label_settings()
        assert settings.mode == "location"
        assert settings.prefix == "NET-"
        assert settings.next_number == 100
        assert settings.custom_pattern == "{floor}-{room}"

    def test_save_overwrites(self) -> None:
        save_label_settings(CableLabelSettings(prefix="A-"))
        save_label_settings(CableLabelSettings(prefix="B-"))
        settings = get_label_settings()
        assert settings.prefix == "B-"


class TestGenerateLabel:
    def test_generates_sequential(self) -> None:
        assert _generate_label() == "C-001"
        assert _generate_label() == "C-002"
        assert _generate_label() == "C-003"

    def test_respects_custom_prefix(self) -> None:
        save_label_settings(CableLabelSettings(prefix="NET-", next_number=42))
        assert _generate_label() == "NET-042"
        assert _generate_label() == "NET-043"


class TestInferCableType:
    def test_none_speed(self) -> None:
        assert _infer_cable_type(None) == "cat6"

    def test_low_speed(self) -> None:
        assert _infer_cable_type(1000) == "cat6"

    def test_2500(self) -> None:
        assert _infer_cable_type(2500) == "cat6"

    def test_high_speed(self) -> None:
        assert _infer_cable_type(10000) == "fiber-om3"

    def test_boundary(self) -> None:
        assert _infer_cable_type(2501) == "fiber-om3"


class TestSyncFromTopology:
    def _mock_topology(
        self,
        edges: list[TopologyEdge] | None = None,
        devices: list[TopologyDevice] | None = None,
    ) -> TopologyDevicesResponse:
        default_devices = [
            TopologyDevice(
                mac="aa:01", name="Gateway", model="UDM-Pro",
                model_name="Dream Machine Pro", type="gateway", ip="10.0.0.1", version="4.0",
            ),
            TopologyDevice(
                mac="aa:02", name="Switch", model="USW-24",
                model_name="Switch 24", type="switch", ip="10.0.0.2", version="7.1",
            ),
        ]
        default_edges = [
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=1, remote_port=1,
                speed=1000, poe=False, wireless=False,
            ),
        ]
        return TopologyDevicesResponse(
            devices=devices or default_devices,
            edges=edges or default_edges,
        )

    def test_creates_cables_from_topology(self) -> None:
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) == 1
        cable = result[0]
        assert cable.source_device_mac == "aa:01"
        assert cable.source_port == 1
        assert cable.dest_device_mac == "aa:02"
        assert cable.dest_port == 1
        assert cable.speed == 1000
        assert cable.poe is False
        assert cable.status == "active"
        assert cable.cable_type == "cat6"
        assert cable.source_device_name == "Gateway"
        assert cable.dest_device_name == "Switch"

    def test_skips_wireless_edges(self) -> None:
        topo = self._mock_topology(edges=[
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=1, remote_port=1,
                speed=1000, poe=False, wireless=True,
            ),
        ])
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) == 0

    def test_skips_edges_without_port(self) -> None:
        topo = self._mock_topology(edges=[
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=None, remote_port=None,
                speed=1000, poe=False, wireless=False,
            ),
        ])
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) == 0

    def test_updates_existing_cables(self) -> None:
        # Pre-create a cable
        create_cable(CableRunInput(
            source_device_mac="aa:01",
            source_port=1,
            dest_device_mac="aa:02",
            dest_port=1,
            speed=100,
            poe=False,
            label="C-MANUAL",
            color="blue",
            length_m=5.0,
        ))
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) == 1
        cable = result[0]
        # Speed/poe updated
        assert cable.speed == 1000
        assert cable.poe is False
        # User fields preserved
        assert cable.label == "C-MANUAL"
        assert cable.color == "blue"
        assert cable.length_m == 5.0

    def test_marks_disappeared_as_disconnected(self) -> None:
        create_cable(CableRunInput(
            source_device_mac="aa:01",
            source_port=99,
            label="C-OLD",
            status="active",
        ))
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            sync_from_topology(MOCK_CREDENTIALS)
        # The old cable should be marked disconnected
        cables = list_cables()
        old_cable = next(c for c in cables if c.label == "C-OLD")
        assert old_cable.status == "disconnected"

    def test_reactivates_disconnected_cables(self) -> None:
        create_cable(CableRunInput(
            source_device_mac="aa:01",
            source_port=1,
            dest_device_mac="aa:02",
            dest_port=1,
            label="C-REACTIVATE",
            status="disconnected",
        ))
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) == 1
        assert result[0].status == "active"

    def test_fiber_inferred_for_high_speed(self) -> None:
        topo = self._mock_topology(edges=[
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=1, remote_port=1,
                speed=10000, poe=False, wireless=False,
            ),
        ])
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert result[0].cable_type == "fiber-om3"

    def test_auto_labels_new_cables(self) -> None:
        topo = self._mock_topology(edges=[
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=1, remote_port=1,
                speed=1000, poe=False, wireless=False,
            ),
            TopologyEdge(
                from_mac="aa:01", to_mac="aa:02", local_port=2, remote_port=2,
                speed=1000, poe=False, wireless=False,
            ),
        ])
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        labels = {c.label for c in result}
        assert "C-001" in labels
        assert "C-002" in labels

    def test_does_not_mark_faulty_as_disconnected(self) -> None:
        create_cable(CableRunInput(
            source_device_mac="aa:01",
            source_port=99,
            label="C-FAULTY",
            status="faulty",
        ))
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            sync_from_topology(MOCK_CREDENTIALS)
        cables = list_cables()
        faulty_cable = next(c for c in cables if c.label == "C-FAULTY")
        assert faulty_cable.status == "faulty"

    def test_sync_with_no_existing_cables(self) -> None:
        """Sync when no cables exist yet -- existing_rows loop is empty."""
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        assert len(result) >= 1

    def test_skips_existing_cables_without_source_mac_or_port(self) -> None:
        """Cables without source_device_mac or source_port are not indexed for sync matching."""
        create_cable(CableRunInput(source_device_mac=None, source_port=None, label="C-NOSRC"))
        create_cable(CableRunInput(source_device_mac="aa:01", source_port=None, label="C-NOPORT"))
        topo = self._mock_topology()
        with patch("app.services.topology.get_topology_devices", return_value=topo):
            result = sync_from_topology(MOCK_CREDENTIALS)
        # The two cables without proper source are ignored in matching; new cable created from edge
        all_cables = list_cables()
        assert len(all_cables) >= 3  # 2 pre-existing + 1 from sync

