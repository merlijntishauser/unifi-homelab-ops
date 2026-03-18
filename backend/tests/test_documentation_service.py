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

        with (
            patch("app.services.documentation.build_topology", return_value=topology),
            patch("app.services.documentation.render_mermaid", return_value="graph LR") as mock_render,
        ):
            section = _build_mermaid_section(devices)

        assert section.item_count == 2
        mock_render.assert_called_once_with([mock_edge, mock_edge])

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


class TestBuildPortOverviewSection:
    def test_generates_section(self) -> None:
        devices = [_make_mock_device()]
        port_map = MagicMock()

        with (
            patch("app.services.documentation.build_port_map", return_value=port_map),
            patch("app.services.documentation.render_device_port_overview", return_value="| Port | Speed |"),
        ):
            section = _build_port_overview_section(devices)

        assert section.id == "port-overview"
        assert section.title == "Port Overview"
        assert section.item_count == 1


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

        with (
            patch("app.services.documentation.get_zones", return_value=zones),
            patch("app.services.documentation.get_zone_pairs", return_value=[pair]),
        ):
            section = _build_firewall_section(CREDENTIALS)

        assert section.id == "firewall-summary"
        assert section.title == "Firewall Summary"
        assert "LAN" in section.content
        assert "WAN" in section.content
        assert "Grade Distribution" in section.content
        assert section.item_count == 1

    def test_empty_zone_pairs(self) -> None:
        with (
            patch("app.services.documentation.get_zones", return_value=[]),
            patch("app.services.documentation.get_zone_pairs", return_value=[]),
        ):
            section = _build_firewall_section(CREDENTIALS)

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

        with (
            patch("app.services.documentation.get_zones", return_value=zones),
            patch("app.services.documentation.get_zone_pairs", return_value=[pair]),
        ):
            section = _build_firewall_section(CREDENTIALS)

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

        with (
            patch("app.services.documentation.get_zones", return_value=zones),
            patch("app.services.documentation.get_zone_pairs", return_value=[pair]),
        ):
            section = _build_firewall_section(CREDENTIALS)

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

        with (
            patch("app.services.documentation.get_latest_snapshots", return_value=snapshots),
            patch("app.services.documentation.fetch_device_stats", return_value=[]),
        ):
            section = _build_metrics_section(CREDENTIALS)

        assert section.id == "metrics-snapshot"
        assert section.title == "Metrics Snapshot"
        assert "USW-Pro" in section.content
        assert "15.5%" in section.content
        assert "42.3%" in section.content
        assert section.item_count == 1

    def test_empty_metrics(self) -> None:
        with (
            patch("app.services.documentation.get_latest_snapshots", return_value=[]),
            patch("app.services.documentation.fetch_device_stats", return_value=[]),
        ):
            section = _build_metrics_section(CREDENTIALS)

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

        with (
            patch("app.services.documentation.get_latest_snapshots", return_value=snapshots),
            patch("app.services.documentation.fetch_device_stats", return_value=[]),
        ):
            section = _build_metrics_section(CREDENTIALS)

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

        with (
            patch("app.services.documentation.get_latest_snapshots", return_value=snapshots),
            patch("app.services.documentation.fetch_device_stats", return_value=[]),
        ):
            section = _build_metrics_section(CREDENTIALS)

        assert "| 0 |" in section.content


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
