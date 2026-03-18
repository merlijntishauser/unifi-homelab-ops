"""Tests for rack planner service."""

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest

from app.config import UnifiCredentials
from app.database import init_db_for_tests, reset_engine
from app.models import RackInput, RackItemInput
from app.services.rack_planner import (
    add_rack_item,
    create_rack,
    delete_rack,
    delete_rack_item,
    get_bom,
    get_rack,
    import_from_topology,
    list_racks,
    move_rack_item,
    update_rack,
    update_rack_item,
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


def _create_test_rack(name: str = "Test Rack", height_u: int = 12) -> int:
    rack = create_rack(RackInput(name=name, height_u=height_u))
    return rack.id


class TestCreateRack:
    def test_creates_rack_with_defaults(self) -> None:
        rack = create_rack(RackInput(name="My Rack"))
        assert rack.name == "My Rack"
        assert rack.size == "19-inch"
        assert rack.height_u == 12
        assert rack.location == ""
        assert rack.items == []
        assert rack.total_power == 0.0
        assert rack.used_u == 0

    def test_creates_rack_with_custom_values(self) -> None:
        rack = create_rack(RackInput(name="Small Rack", size="10-inch", height_u=6, location="Closet"))
        assert rack.size == "10-inch"
        assert rack.height_u == 6
        assert rack.location == "Closet"


class TestListRacks:
    def test_empty_list(self) -> None:
        assert list_racks() == []

    def test_lists_created_racks(self) -> None:
        create_rack(RackInput(name="Rack A"))
        create_rack(RackInput(name="Rack B"))
        result = list_racks()
        assert len(result) == 2
        names = {r.name for r in result}
        assert names == {"Rack A", "Rack B"}

    def test_summary_includes_stats(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, height_u=2, label="Switch", power_watts=30.0))
        add_rack_item(rack_id, RackItemInput(position_u=3, label="Patch Panel", power_watts=0.0))
        result = list_racks()
        assert len(result) == 1
        assert result[0].item_count == 2
        assert result[0].used_u == 3
        assert result[0].total_power == 30.0


class TestGetRack:
    def test_returns_rack_with_items(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="Device"))
        rack = get_rack(rack_id)
        assert rack.name == "Test Rack"
        assert len(rack.items) == 1
        assert rack.items[0].label == "Device"

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            get_rack(9999)


class TestUpdateRack:
    def test_updates_metadata(self) -> None:
        rack_id = _create_test_rack()
        updated = update_rack(rack_id, RackInput(name="Updated", size="10-inch", height_u=8, location="Room"))
        assert updated.name == "Updated"
        assert updated.size == "10-inch"
        assert updated.height_u == 8
        assert updated.location == "Room"

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            update_rack(9999, RackInput(name="X"))

    def test_cannot_reduce_height_below_items(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        add_rack_item(rack_id, RackItemInput(position_u=10, height_u=2, label="Top Device"))
        with pytest.raises(ValueError, match="Cannot reduce height"):
            update_rack(rack_id, RackInput(name="Test Rack", height_u=6))


class TestDeleteRack:
    def test_deletes_rack_and_items(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="Item"))
        delete_rack(rack_id)
        with pytest.raises(ValueError, match="not found"):
            get_rack(rack_id)

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            delete_rack(9999)


class TestAddRackItem:
    def test_adds_item(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, height_u=2, device_type="switch", label="USW-24",
            power_watts=25.0, device_mac="aa:bb:cc:dd:ee:01", notes="Main switch",
        ))
        assert item.position_u == 1
        assert item.height_u == 2
        assert item.device_type == "switch"
        assert item.label == "USW-24"
        assert item.power_watts == 25.0
        assert item.device_mac == "aa:bb:cc:dd:ee:01"
        assert item.notes == "Main switch"

    def test_rack_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            add_rack_item(9999, RackItemInput(position_u=1, label="X"))

    def test_overlap_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, height_u=2, label="First"))
        with pytest.raises(ValueError, match="overlaps"):
            add_rack_item(rack_id, RackItemInput(position_u=2, label="Second"))

    def test_exceeds_height_raises(self) -> None:
        rack_id = _create_test_rack(height_u=4)
        with pytest.raises(ValueError, match="exceeds rack height"):
            add_rack_item(rack_id, RackItemInput(position_u=4, height_u=2, label="Too Tall"))

    def test_position_below_one_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="Position must be >= 1"):
            add_rack_item(rack_id, RackItemInput(position_u=0, label="Bad"))

    def test_height_below_zero_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="Height must be >= 0"):
            add_rack_item(rack_id, RackItemInput(position_u=1, height_u=-1, label="Bad"))

    def test_adjacent_items_no_overlap(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, height_u=2, label="First"))
        item = add_rack_item(rack_id, RackItemInput(position_u=3, height_u=1, label="Second"))
        assert item.position_u == 3


class TestUpdateRackItem:
    def test_updates_item(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(position_u=1, label="Old"))
        updated = update_rack_item(rack_id, item.id, RackItemInput(
            position_u=1, label="New", power_watts=50.0,
        ))
        assert updated.label == "New"
        assert updated.power_watts == 50.0

    def test_not_found_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="not found"):
            update_rack_item(rack_id, 9999, RackItemInput(position_u=1, label="X"))

    def test_wrong_rack_raises(self) -> None:
        rack_a = _create_test_rack("Rack A")
        rack_b = _create_test_rack("Rack B")
        item = add_rack_item(rack_a, RackItemInput(position_u=1, label="A"))
        with pytest.raises(ValueError, match="not found"):
            update_rack_item(rack_b, item.id, RackItemInput(position_u=1, label="B"))

    def test_move_to_overlapping_position_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="First"))
        item2 = add_rack_item(rack_id, RackItemInput(position_u=3, label="Second"))
        with pytest.raises(ValueError, match="overlaps"):
            update_rack_item(rack_id, item2.id, RackItemInput(position_u=1, label="Second"))

    def test_can_update_in_same_position(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(position_u=1, label="Original"))
        updated = update_rack_item(rack_id, item.id, RackItemInput(position_u=1, label="Renamed"))
        assert updated.label == "Renamed"


class TestDeleteRackItem:
    def test_deletes_item(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(position_u=1, label="Item"))
        delete_rack_item(rack_id, item.id)
        rack = get_rack(rack_id)
        assert len(rack.items) == 0

    def test_not_found_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="not found"):
            delete_rack_item(rack_id, 9999)

    def test_wrong_rack_raises(self) -> None:
        rack_a = _create_test_rack("Rack A")
        rack_b = _create_test_rack("Rack B")
        item = add_rack_item(rack_a, RackItemInput(position_u=1, label="A"))
        with pytest.raises(ValueError, match="not found"):
            delete_rack_item(rack_b, item.id)


class TestMoveRackItem:
    def test_moves_item(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(position_u=1, label="Device"))
        moved = move_rack_item(rack_id, item.id, 5)
        assert moved.position_u == 5

    def test_overlap_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="First"))
        item2 = add_rack_item(rack_id, RackItemInput(position_u=3, label="Second"))
        with pytest.raises(ValueError, match="overlaps"):
            move_rack_item(rack_id, item2.id, 1)

    def test_exceeds_height_raises(self) -> None:
        rack_id = _create_test_rack(height_u=4)
        item = add_rack_item(rack_id, RackItemInput(position_u=1, height_u=2, label="Device"))
        with pytest.raises(ValueError, match="exceeds rack height"):
            move_rack_item(rack_id, item.id, 4)

    def test_not_found_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="not found"):
            move_rack_item(rack_id, 9999, 1)


class TestGetBom:
    def test_empty_rack(self) -> None:
        rack_id = _create_test_rack(height_u=6)
        bom = get_bom(rack_id)
        assert bom.rack_name == "Test Rack"
        assert len(bom.entries) == 1
        blanking = bom.entries[0]
        assert blanking.item_type == "blanking-plate"
        assert blanking.quantity == 6

    def test_rack_with_devices(self) -> None:
        rack_id = _create_test_rack(height_u=6)
        add_rack_item(rack_id, RackItemInput(position_u=1, height_u=2, label="Switch", power_watts=25.0))
        add_rack_item(rack_id, RackItemInput(position_u=3, label="Patch Panel"))
        bom = get_bom(rack_id)
        devices = [e for e in bom.entries if e.item_type == "device"]
        assert len(devices) == 2
        blanking = [e for e in bom.entries if e.item_type == "blanking-plate"]
        assert len(blanking) == 1
        assert blanking[0].quantity == 3  # 6 - 2 - 1 = 3 empty

    def test_bom_includes_shelf_suggestion_for_aps(self) -> None:
        rack_id = _create_test_rack(height_u=4)
        add_rack_item(rack_id, RackItemInput(position_u=1, device_type="ap", label="AP-1"))
        add_rack_item(rack_id, RackItemInput(position_u=2, device_type="ap", label="AP-2"))
        bom = get_bom(rack_id)
        suggestions = [e for e in bom.entries if e.item_type == "suggestion"]
        assert len(suggestions) == 1
        assert suggestions[0].quantity == 2

    def test_bom_device_notes_include_power(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="Switch", power_watts=25.5))
        bom = get_bom(rack_id)
        devices = [e for e in bom.entries if e.item_type == "device"]
        assert "25.5W" in devices[0].notes

    def test_bom_device_notes_without_power(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(position_u=1, label="Shelf", power_watts=0.0))
        bom = get_bom(rack_id)
        devices = [e for e in bom.entries if e.item_type == "device"]
        assert "W" not in devices[0].notes

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            get_bom(9999)


class TestImportFromTopology:
    def _mock_topology_response(self) -> object:
        from app.models import TopologyDevice, TopologyDevicesResponse

        devices = [
            TopologyDevice(
                mac="aa:bb:cc:dd:ee:01", name="Gateway", model="UDM-Pro",
                model_name="Dream Machine Pro", type="gateway", ip="192.168.1.1", version="4.0.6",
            ),
            TopologyDevice(
                mac="aa:bb:cc:dd:ee:02", name="Switch-24", model="USW-24",
                model_name="UniFi Switch 24", type="switch", ip="192.168.1.2", version="7.1.0",
            ),
            TopologyDevice(
                mac="aa:bb:cc:dd:ee:03", name="AP-Office", model="U6-LR",
                model_name="UniFi 6 Long Range", type="ap", ip="192.168.1.3", version="6.6.77",
            ),
        ]
        return TopologyDevicesResponse(devices=devices, edges=[])

    def test_imports_devices(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        with patch("app.services.topology.get_topology_devices", return_value=self._mock_topology_response()):
            result = import_from_topology(rack_id, MOCK_CREDENTIALS)
        assert len(result) == 3
        types = {r.device_type for r in result}
        assert types == {"gateway", "switch", "ap"}

    def test_skips_already_linked_devices(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Gateway", device_mac="aa:bb:cc:dd:ee:01",
        ))
        with patch("app.services.topology.get_topology_devices", return_value=self._mock_topology_response()):
            result = import_from_topology(rack_id, MOCK_CREDENTIALS)
        assert len(result) == 2
        macs = {r.device_mac for r in result}
        assert "aa:bb:cc:dd:ee:01" not in macs

    def test_ap_gets_shelf_note(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        with patch("app.services.topology.get_topology_devices", return_value=self._mock_topology_response()):
            result = import_from_topology(rack_id, MOCK_CREDENTIALS)
        aps = [r for r in result if r.device_type == "ap"]
        assert len(aps) == 1
        assert "shelf recommended" in aps[0].notes

    def test_stops_when_rack_full(self) -> None:
        rack_id = _create_test_rack(height_u=2)
        # Fill 2 of 2 slots
        add_rack_item(rack_id, RackItemInput(position_u=1, label="Existing 1"))
        add_rack_item(rack_id, RackItemInput(position_u=2, label="Existing 2"))
        with patch("app.services.topology.get_topology_devices", return_value=self._mock_topology_response()):
            result = import_from_topology(rack_id, MOCK_CREDENTIALS)
        assert len(result) == 0

    def test_skips_unknown_device_types(self) -> None:
        from app.models import TopologyDevice, TopologyDevicesResponse

        response = TopologyDevicesResponse(
            devices=[
                TopologyDevice(
                    mac="aa:bb:cc:dd:ee:99", name="Unknown Thing", model="UNKNOWN",
                    model_name="Unknown", type="other", ip="192.168.1.99", version="1.0",
                ),
            ],
            edges=[],
        )
        rack_id = _create_test_rack(height_u=12)
        with patch("app.services.topology.get_topology_devices", return_value=response):
            result = import_from_topology(rack_id, MOCK_CREDENTIALS)
        assert len(result) == 0

    def test_not_found_raises(self) -> None:
        with pytest.raises(ValueError, match="not found"):
            import_from_topology(9999, MOCK_CREDENTIALS)


class TestHalfWidthItems:
    def test_half_width_items_side_by_side(self) -> None:
        rack_id = _create_test_rack()
        left = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Left", width_fraction=0.5, position_x=0.0,
        ))
        right = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Right", width_fraction=0.5, position_x=0.5,
        ))
        assert left.width_fraction == 0.5
        assert left.position_x == 0.0
        assert right.width_fraction == 0.5
        assert right.position_x == 0.5

    def test_half_width_items_overlapping_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Left", width_fraction=0.5, position_x=0.0,
        ))
        with pytest.raises(ValueError, match="overlaps"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Overlap", width_fraction=0.5, position_x=0.25,
            ))

    def test_half_width_different_rows_no_overlap(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Row 1", width_fraction=0.5, position_x=0.0,
        ))
        item = add_rack_item(rack_id, RackItemInput(
            position_u=2, label="Row 2", width_fraction=0.5, position_x=0.0,
        ))
        assert item.position_u == 2


class TestQuarterWidthItems:
    def test_four_quarter_width_items_in_one_row(self) -> None:
        rack_id = _create_test_rack()
        items = []
        for i, x in enumerate([0.0, 0.25, 0.5, 0.75]):
            item = add_rack_item(rack_id, RackItemInput(
                position_u=1, label=f"Q{i}", width_fraction=0.25, position_x=x,
            ))
            items.append(item)
        assert len(items) == 4
        assert all(i.width_fraction == 0.25 for i in items)

    def test_quarter_width_overlap_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Half", width_fraction=0.5, position_x=0.0,
        ))
        with pytest.raises(ValueError, match="overlaps"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Quarter", width_fraction=0.25, position_x=0.25,
            ))

    def test_quarter_after_half_no_overlap(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Half", width_fraction=0.5, position_x=0.0,
        ))
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Quarter", width_fraction=0.25, position_x=0.5,
        ))
        assert item.position_x == 0.5


class TestZeroUItems:
    def test_zero_u_item_is_allowed(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(
            position_u=0, height_u=0, label="Cable Manager",
        ))
        assert item.height_u == 0
        assert item.position_u == 0

    def test_zero_u_does_not_cause_overlap(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=0, height_u=0, label="Cable Manager",
        ))
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Switch",
        ))
        assert item.position_u == 1

    def test_zero_u_items_coexist(self) -> None:
        rack_id = _create_test_rack()
        a = add_rack_item(rack_id, RackItemInput(position_u=0, height_u=0, label="CM-1"))
        b = add_rack_item(rack_id, RackItemInput(position_u=0, height_u=0, label="CM-2"))
        assert a.height_u == 0
        assert b.height_u == 0


class TestFiveUItems:
    def test_five_u_item_fits(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, height_u=5, label="Server",
        ))
        assert item.height_u == 5

    def test_five_u_item_overlap(self) -> None:
        rack_id = _create_test_rack(height_u=12)
        add_rack_item(rack_id, RackItemInput(position_u=1, height_u=5, label="Server 1"))
        with pytest.raises(ValueError, match="overlaps"):
            add_rack_item(rack_id, RackItemInput(position_u=3, height_u=2, label="Server 2"))


class TestWidthValidation:
    def test_position_x_plus_width_exceeds_rack(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="exceeds rack width"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Bad", width_fraction=0.5, position_x=0.75,
            ))

    def test_invalid_width_fraction(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="width_fraction must be one of"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Bad", width_fraction=0.3,
            ))

    def test_invalid_position_x(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="position_x must be one of"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Bad", position_x=0.1,
            ))

    def test_full_width_at_nonzero_x_raises(self) -> None:
        rack_id = _create_test_rack()
        with pytest.raises(ValueError, match="exceeds rack width"):
            add_rack_item(rack_id, RackItemInput(
                position_u=1, label="Bad", width_fraction=1.0, position_x=0.25,
            ))


class TestMoveWithPositionX:
    def test_move_with_position_x(self) -> None:
        rack_id = _create_test_rack()
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Half", width_fraction=0.5, position_x=0.0,
        ))
        moved = move_rack_item(rack_id, item.id, 3, new_position_x=0.5)
        assert moved.position_u == 3
        assert moved.position_x == 0.5

    def test_move_half_width_to_occupied_half_raises(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=3, label="Existing", width_fraction=0.5, position_x=0.5,
        ))
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Mover", width_fraction=0.5, position_x=0.0,
        ))
        with pytest.raises(ValueError, match="overlaps"):
            move_rack_item(rack_id, item.id, 3, new_position_x=0.5)

    def test_move_half_width_to_free_half(self) -> None:
        rack_id = _create_test_rack()
        add_rack_item(rack_id, RackItemInput(
            position_u=3, label="Existing", width_fraction=0.5, position_x=0.0,
        ))
        item = add_rack_item(rack_id, RackItemInput(
            position_u=1, label="Mover", width_fraction=0.5, position_x=0.0,
        ))
        moved = move_rack_item(rack_id, item.id, 3, new_position_x=0.5)
        assert moved.position_u == 3
        assert moved.position_x == 0.5
