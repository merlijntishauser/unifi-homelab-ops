"""Tests for documentation service."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from app.config import UnifiCredentials
from app.models import (
    DocumentationSection,
    FindingModel,
    MetricsSnapshot,
    Zone,
    ZonePair,
    ZonePairAnalysis,
)
from app.services.documentation import (
    _build_firewall_section,
    _build_inventory_section,
    _build_lldp_section,
    _build_mermaid_section,
    _build_metrics_section,
    _build_port_overview_section,
    _fetch_clients,
    _fetch_controller_data,
    get_documentation_export,
    get_documentation_sections,
)

CREDENTIALS = UnifiCredentials(
    url="https://unifi.example.com",
    username="admin",
    password="secret",
)


def _make_mock_device(
    mac: str = "aa:bb:cc:dd:ee:ff",
    name: str = "TestDevice",
    device_type: str = "switch",
) -> MagicMock:
    device = MagicMock()
    device.mac = mac
    device.name = name
    device.type = device_type
    device.port_table = []
    device.lldp_info = []
    return device


def _make_mock_topology(edges: list[Any] | None = None) -> MagicMock:
    topology = MagicMock()
    topology.tree_edges = edges or []
    topology.raw_edges = edges or []
    return topology


class TestFetchControllerData:
    def test_fetches_and_normalizes(self) -> None:
        raw = [{"mac": "aa:bb:cc:dd:ee:ff", "name": "Switch"}]
        normalized = [_make_mock_device()]
        with (
            patch("app.services.documentation.to_topology_config") as mock_config,
            patch("app.services.documentation.fetch_devices", return_value=iter(raw)),
            patch("app.services.documentation.normalize_devices", return_value=normalized),
        ):
            mock_config.return_value = MagicMock()
            raw_result, devices_result = _fetch_controller_data(CREDENTIALS)

        assert len(raw_result) == 1
        assert len(devices_result) == 1


class TestBuildMermaidSection:
    def test_generates_section(self) -> None:
        mock_edge = MagicMock()
        topology = _make_mock_topology([mock_edge])
        devices = [_make_mock_device()]

        with (
            patch("app.services.documentation.build_topology", return_value=topology),
            patch("app.services.documentation.render_mermaid", return_value="graph LR\nA-->B"),
        ):
            section = _build_mermaid_section(devices)

        assert section.id == "mermaid-topology"
        assert section.title == "Network Topology"
        assert "graph LR" in section.content
        assert section.item_count == 1

    def test_uses_raw_edges_when_tree_empty(self) -> None:
        mock_edge = MagicMock()
        topology = MagicMock()
        topology.tree_edges = []
        topology.raw_edges = [mock_edge, mock_edge]
        devices = [_make_mock_device()]
        mock_names = {"aa:bb:cc:dd:ee:ff": "TestDevice"}

        with (
            patch("app.services.documentation.build_topology", return_value=topology),
            patch("app.services.documentation.build_node_names", return_value=mock_names),
            patch("app.services.documentation.render_mermaid", return_value="graph LR") as mock_render,
        ):
            section = _build_mermaid_section(devices)

        assert section.item_count == 2
        mock_render.assert_called_once_with([mock_edge, mock_edge], node_names=mock_names)

    def test_gateway_macs_passed_to_build_topology(self) -> None:
        gw = _make_mock_device(mac="gw:mac", device_type="gateway")
        sw = _make_mock_device(mac="sw:mac", device_type="switch")
        topology = _make_mock_topology()

        with (
            patch("app.services.documentation.build_topology", return_value=topology) as mock_build,
            patch("app.services.documentation.render_mermaid", return_value=""),
        ):
            _build_mermaid_section([gw, sw])

        call_kwargs = mock_build.call_args
        assert "gw:mac" in call_kwargs.kwargs["gateways"]
        assert "sw:mac" not in call_kwargs.kwargs["gateways"]


class TestBuildInventorySection:
    def test_generates_section(self) -> None:
        devices = [_make_mock_device(), _make_mock_device(mac="11:22:33:44:55:66")]
        inventory = [MagicMock(), MagicMock()]

        with (
            patch("app.services.documentation.build_device_inventory", return_value=inventory),
            patch("app.services.documentation.render_device_inventory_table", return_value="| Name | Model |"),
            patch("app.services.documentation.resolve_hostnames", return_value={}),
        ):
            section = _build_inventory_section(devices, CREDENTIALS)

        assert section.id == "device-inventory"
        assert section.title == "Device Inventory"
        assert "Name" in section.content
        assert section.item_count == 2


def _make_mock_port(port_idx: int) -> MagicMock:
    port = MagicMock()
    port.port_idx = port_idx
    port.name = f"Port {port_idx}"
    port.speed = 1000
    port.up = True
    port.poe_enable = False
    port.poe_power = None
    port.native_vlan = 1
    return port


class TestBuildPortOverviewSection:
    def test_generates_section(self) -> None:
        devices = [_make_mock_device()]
        port_map = MagicMock()

        with (
            patch("app.services.documentation.build_port_map", return_value=port_map),
            patch("app.services.documentation.build_client_port_map", return_value={}),
            patch("app.services.documentation.build_node_names", return_value={}),
            patch("app.services.documentation.render_device_port_overview", return_value="| Port | Speed |"),
        ):
            section = _build_port_overview_section(devices, [])

        assert section.id == "port-overview"
        assert section.title == "Port Overview"
        assert section.item_count == 1

    def test_passes_wired_clients_to_the_renderer(self) -> None:
        devices = [_make_mock_device()]
        clients = [MagicMock()]
        client_ports = {"aa:bb:cc:dd:ee:ff": [(3, "11:22:33:44:55:66")]}

        with (
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch("app.services.documentation.build_client_port_map", return_value=client_ports) as mock_cpm,
            patch("app.services.documentation.build_node_names", return_value={}) as mock_names,
            patch("app.services.documentation.render_device_port_overview", return_value="") as mock_render,
        ):
            _build_port_overview_section(devices, clients)

        # Wired only: the table describes physical ports, so wireless is excluded.
        assert mock_cpm.call_args.kwargs["client_mode"] == "wired"
        assert mock_names.call_args.kwargs["client_mode"] == "wired"
        assert mock_render.call_args.kwargs["client_ports"] == client_ports
        assert "node_names" in mock_render.call_args.kwargs

    def test_port_data_includes_connected_client_name(self) -> None:
        device = _make_mock_device()
        device.port_table = [_make_mock_port(3)]

        with (
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch(
                "app.services.documentation.build_client_port_map",
                return_value={"aa:bb:cc:dd:ee:ff": [(3, "11:22:33:44:55:66")]},
            ),
            patch("app.services.documentation.build_node_names", return_value={"11:22:33:44:55:66": "NAS"}),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
        ):
            section = _build_port_overview_section([device], [MagicMock()])

        assert section.data is not None
        assert section.data[0]["connected_client"] == "NAS"

    def test_port_data_falls_back_to_client_id_without_a_name(self) -> None:
        device = _make_mock_device()
        device.port_table = [_make_mock_port(3)]

        with (
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch(
                "app.services.documentation.build_client_port_map",
                return_value={"aa:bb:cc:dd:ee:ff": [(3, "11:22:33:44:55:66")]},
            ),
            patch("app.services.documentation.build_node_names", return_value={}),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
        ):
            section = _build_port_overview_section([device], [MagicMock()])

        assert section.data is not None
        assert section.data[0]["connected_client"] == "11:22:33:44:55:66"

    def test_port_data_joins_multiple_clients_on_one_port(self) -> None:
        device = _make_mock_device()
        device.port_table = [_make_mock_port(3)]

        with (
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch(
                "app.services.documentation.build_client_port_map",
                return_value={"aa:bb:cc:dd:ee:ff": [(3, "client-a"), (3, "client-b")]},
            ),
            patch("app.services.documentation.build_node_names", return_value={"client-a": "NAS", "client-b": "Printer"}),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
        ):
            section = _build_port_overview_section([device], [MagicMock()])

        assert section.data is not None
        assert section.data[0]["connected_client"] == "NAS, Printer"

    def test_port_data_leaves_an_empty_port_null(self) -> None:
        device = _make_mock_device()
        device.port_table = [_make_mock_port(7)]

        with (
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch("app.services.documentation.build_client_port_map", return_value={}),
            patch("app.services.documentation.build_node_names", return_value={}),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
        ):
            section = _build_port_overview_section([device], [])

        assert section.data is not None
        assert section.data[0]["connected_client"] is None


class TestPortOverviewIntegration:
    """End-to-end through the real unifi_topology library, no mocks.

    The mocked tests above would still pass if the library contract shifted
    under us, and the e2e mock controller serves an empty client list, so this
    is the only place the client wiring is actually exercised.
    """

    @staticmethod
    def _raw_switch() -> dict[str, Any]:
        # `lldp_table` must be present (may be empty) or normalize_devices
        # discards the device as malformed.
        return {
            "mac": "aa:bb:cc:dd:ee:02", "name": "Core Switch", "type": "usw",
            "model": "US24P250", "ip": "192.168.1.2", "lldp_table": [],
            "port_table": [
                {"port_idx": 1, "poe_mode": "auto", "poe_power": "15.2"},
                {"port_idx": 2},
            ],
        }

    def test_wired_client_appears_in_content_and_data(self) -> None:
        from unifi_topology import normalize_devices

        devices = normalize_devices([self._raw_switch()])
        clients = [{
            "mac": "11:22:33:44:55:66", "name": "Synology-NAS",
            "is_wired": True, "sw_mac": "aa:bb:cc:dd:ee:02", "sw_port": 1,
        }]

        section = _build_port_overview_section(devices, clients)

        assert "Synology-NAS" in section.content
        assert section.data is not None
        rows = {row["port"]: row["connected_client"] for row in section.data}
        assert rows[1] == "Synology-NAS"
        assert rows[2] is None

    def test_wireless_client_is_excluded(self) -> None:
        from unifi_topology import normalize_devices

        devices = normalize_devices([self._raw_switch()])
        clients = [{
            "mac": "77:88:99:aa:bb:cc", "name": "Wifi-Phone",
            "is_wired": False, "ap_mac": "aa:bb:cc:dd:ee:02", "ap_port": 1,
        }]

        section = _build_port_overview_section(devices, clients)

        assert "Wifi-Phone" not in section.content
        assert section.data is not None
        assert all(row["connected_client"] is None for row in section.data)

    def test_no_clients_still_renders_ports(self) -> None:
        from unifi_topology import normalize_devices

        devices = normalize_devices([self._raw_switch()])

        section = _build_port_overview_section(devices, [])

        assert "Core Switch" in section.content
        assert section.data is not None
        assert len(section.data) == 2


class TestFetchClients:
    def test_returns_fetched_clients(self) -> None:
        clients = [{"mac": "11:22:33:44:55:66"}]

        with (
            patch("app.services.documentation.to_topology_config"),
            patch("app.services.documentation.fetch_clients", return_value=iter(clients)),
        ):
            assert _fetch_clients(CREDENTIALS) == clients

    def test_degrades_to_empty_list_on_failure(self) -> None:
        with (
            patch("app.services.documentation.to_topology_config"),
            patch("app.services.documentation.fetch_clients", side_effect=RuntimeError("controller down")),
        ):
            assert _fetch_clients(CREDENTIALS) == []


class TestBuildLldpSection:
    def test_generates_section(self) -> None:
        device = _make_mock_device()
        lldp1 = MagicMock()
        lldp2 = MagicMock()
        device.lldp_info = [lldp1, lldp2]

        with patch("app.services.documentation.render_lldp_md", return_value="| Neighbor | Port |"):
            section = _build_lldp_section([device])

        assert section.id == "lldp-neighbors"
        assert section.title == "LLDP Neighbors"
        assert section.item_count == 2

    def test_zero_lldp_entries(self) -> None:
        device = _make_mock_device()
        device.lldp_info = []

        with patch("app.services.documentation.render_lldp_md", return_value="No LLDP data"):
            section = _build_lldp_section([device])

        assert section.item_count == 0


class TestBuildFirewallSection:
    def test_generates_section_with_pairs(self) -> None:
        zones = [
            Zone(id="z1", name="LAN"),
            Zone(id="z2", name="WAN"),
        ]
        pair = ZonePair(
            source_zone_id="z1",
            destination_zone_id="z2",
            rules=[],
            allow_count=3,
            block_count=1,
            analysis=ZonePairAnalysis(
                score=80,
                grade="B",
                findings=[
                    FindingModel(id="f1", severity="medium", title="Test", description="desc"),
                ],
            ),
        )

        section = _build_firewall_section(zones, [pair])

        assert section.id == "firewall-summary"
        assert section.title == "Firewall Summary"
        assert "LAN" in section.content
        assert "WAN" in section.content
        assert "Grade Distribution" in section.content
        assert section.item_count == 1

    def test_empty_zone_pairs(self) -> None:
        section = _build_firewall_section([], [])

        assert section.item_count == 0
        assert "Total zone pairs: 0" in section.content

    def test_pair_without_analysis(self) -> None:
        zones = [Zone(id="z1", name="LAN")]
        pair = ZonePair(
            source_zone_id="z1",
            destination_zone_id="z1",
            rules=[],
            allow_count=0,
            block_count=0,
            analysis=None,
        )

        section = _build_firewall_section(zones, [pair])

        assert "- |" in section.content

    def test_findings_by_severity_ordering(self) -> None:
        zones = [Zone(id="z1", name="A"), Zone(id="z2", name="B")]
        pair = ZonePair(
            source_zone_id="z1",
            destination_zone_id="z2",
            rules=[],
            allow_count=0,
            block_count=0,
            analysis=ZonePairAnalysis(
                score=50,
                grade="D",
                findings=[
                    FindingModel(id="f1", severity="critical", title="T1", description="d1"),
                    FindingModel(id="f2", severity="low", title="T2", description="d2"),
                    FindingModel(id="f3", severity="critical", title="T3", description="d3"),
                ],
            ),
        )

        section = _build_firewall_section(zones, [pair])

        assert "critical" in section.content
        assert "low" in section.content
        # critical should appear before low in the table
        crit_pos = section.content.index("critical")
        low_pos = section.content.index("low")
        assert crit_pos < low_pos


class TestBuildMetricsSection:
    def test_generates_section_with_data(self) -> None:
        snapshots = [
            MetricsSnapshot(
                mac="aa:bb:cc:dd:ee:ff",
                name="USW-Pro",
                model="USW-Pro-24",
                type="switch",
                cpu=15.5,
                mem=42.3,
                uptime=86400,
                num_sta=12,
                status="online",
            ),
        ]

        section = _build_metrics_section(snapshots)

        assert section.id == "metrics-snapshot"
        assert section.title == "Metrics Snapshot"
        assert "USW-Pro" in section.content
        assert "15.5%" in section.content
        assert "42.3%" in section.content
        assert section.item_count == 1

    def test_empty_metrics(self) -> None:
        section = _build_metrics_section([])

        assert section.item_count == 0
        assert "No metrics data available" in section.content

    def test_uptime_converted_to_hours(self) -> None:
        snapshots = [
            MetricsSnapshot(
                mac="aa:bb:cc:dd:ee:ff",
                name="GW",
                model="UDM",
                type="gateway",
                cpu=5.0,
                mem=30.0,
                uptime=7200,
                status="online",
            ),
        ]

        section = _build_metrics_section(snapshots)

        assert "| 2 |" in section.content

    def test_zero_uptime(self) -> None:
        snapshots = [
            MetricsSnapshot(
                mac="aa:bb:cc:dd:ee:ff",
                name="AP",
                model="UAP",
                type="ap",
                cpu=1.0,
                mem=10.0,
                uptime=0,
                status="offline",
            ),
        ]

        section = _build_metrics_section(snapshots)

        assert "| 0 |" in section.content


class TestResolveDeviceHostnames:
    def test_returns_empty_when_url_has_no_hostname(self) -> None:
        from app.services.documentation import _resolve_device_hostnames

        creds = UnifiCredentials(url="file:///path", username="admin", password="secret")
        result = _resolve_device_hostnames([], creds)
        assert result == {}

    def test_returns_empty_on_exception(self) -> None:
        from app.services.documentation import _resolve_device_hostnames

        device = _make_mock_device()
        device.ip = "192.168.1.1"
        with patch("app.services.documentation.resolve_hostnames", side_effect=RuntimeError("DNS fail")):
            result = _resolve_device_hostnames([device], CREDENTIALS)
        assert result == {}


class TestBuildPortData:
    def test_builds_port_rows(self) -> None:
        from app.services.documentation import _build_port_data

        device = _make_mock_device(name="Switch")
        port = MagicMock()
        port.port_idx = 1
        port.name = "Port 1"
        port.speed = 1000
        port.up = True
        port.poe_enable = True
        port.poe_power = 15.0
        port.native_vlan = 1
        device.port_table = [port]

        rows = _build_port_data([device], {}, {})
        assert len(rows) == 1
        assert rows[0]["device"] == "Switch"
        assert rows[0]["port"] == 1
        assert rows[0]["speed"] == 1000
        assert rows[0]["connected_client"] is None


class TestGetDocumentationSectionsStatsException:
    def test_handles_stats_fetch_failure(self) -> None:
        raw = [{"mac": "aa:bb:cc:dd:ee:ff"}]
        devices = [_make_mock_device()]
        devices[0].lldp_info = []
        topology = _make_mock_topology()

        with (
            patch("app.services.documentation.to_topology_config"),
            patch("app.services.documentation.fetch_devices", return_value=iter(raw)),
            patch("app.services.documentation.normalize_devices", return_value=devices),
            patch("app.services.documentation.build_topology", return_value=topology),
            patch("app.services.documentation.render_mermaid", return_value="graph LR"),
            patch("app.services.documentation.build_device_inventory", return_value=[]),
            patch("app.services.documentation.render_device_inventory_table", return_value=""),
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
            patch("app.services.documentation.render_lldp_md", return_value=""),
            patch("app.services.documentation.get_zones", return_value=[]),
            patch("app.services.documentation.get_zone_pairs", return_value=[]),
            patch("app.services.documentation.fetch_device_stats", side_effect=RuntimeError("fail")),
            patch("app.services.documentation.get_latest_snapshots", return_value=[]) as mock_snap,
        ):
            sections = get_documentation_sections(CREDENTIALS)

        assert len(sections) == 6
        # stats=None should be passed to get_latest_snapshots
        mock_snap.assert_called_once_with(None)


class TestGetDocumentationSections:
    def test_returns_all_sections(self) -> None:
        raw = [{"mac": "aa:bb:cc:dd:ee:ff"}]
        devices = [_make_mock_device()]
        devices[0].lldp_info = []
        topology = _make_mock_topology()

        with (
            patch("app.services.documentation.to_topology_config"),
            patch("app.services.documentation.fetch_devices", return_value=iter(raw)),
            patch("app.services.documentation.normalize_devices", return_value=devices),
            patch("app.services.documentation.build_topology", return_value=topology),
            patch("app.services.documentation.render_mermaid", return_value="graph LR"),
            patch("app.services.documentation.build_device_inventory", return_value=[]),
            patch("app.services.documentation.render_device_inventory_table", return_value=""),
            patch("app.services.documentation.build_port_map", return_value=MagicMock()),
            patch("app.services.documentation.render_device_port_overview", return_value=""),
            patch("app.services.documentation.render_lldp_md", return_value=""),
            patch("app.services.documentation.get_zones", return_value=[]),
            patch("app.services.documentation.get_zone_pairs", return_value=[]),
            patch("app.services.documentation.fetch_device_stats", return_value=[]),
            patch("app.services.documentation.normalize_device_stats", return_value=[]),
            patch("app.services.documentation.get_latest_snapshots", return_value=[]),
        ):
            sections = get_documentation_sections(CREDENTIALS)

        assert len(sections) == 6
        ids = [s.id for s in sections]
        assert "mermaid-topology" in ids
        assert "device-inventory" in ids
        assert "port-overview" in ids
        assert "lldp-neighbors" in ids
        assert "firewall-summary" in ids
        assert "metrics-snapshot" in ids


class TestGetDocumentationExport:
    def test_concatenates_sections(self) -> None:
        sections = [
            DocumentationSection(id="s1", title="Section One", content="Content one."),
            DocumentationSection(id="s2", title="Section Two", content="Content two."),
        ]

        with patch("app.services.documentation.get_documentation_sections", return_value=sections):
            result = get_documentation_export(CREDENTIALS)

        assert "# Network Documentation" in result
        assert "## Section One" in result
        assert "Content one." in result
        assert "## Section Two" in result
        assert "Content two." in result

    def test_empty_sections(self) -> None:
        with patch("app.services.documentation.get_documentation_sections", return_value=[]):
            result = get_documentation_export(CREDENTIALS)

        assert "# Network Documentation" in result
