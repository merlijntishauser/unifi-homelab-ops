"""Documentation service.

Generates Markdown documentation sections from UniFi controller data,
including topology diagrams, device inventories, port overviews, LLDP
neighbor tables, firewall summaries, and metrics snapshots.
"""

from __future__ import annotations

from typing import Any

import structlog
from unifi_topology import (
    build_device_inventory,
    build_topology,
    fetch_device_stats,
    fetch_devices,
    normalize_device_stats,
    normalize_devices,
    resolve_hostnames,
)
from unifi_topology.model.edges import build_port_map
from unifi_topology.render import (
    render_device_inventory_table,
    render_device_port_overview,
    render_lldp_md,
    render_mermaid,
)

from app.config import UnifiCredentials
from app.models import DocumentationSection
from app.services.firewall import get_zone_pairs, get_zones, to_topology_config
from app.services.metrics import get_latest_snapshots

log = structlog.get_logger()


def _fetch_controller_data(credentials: UnifiCredentials) -> tuple[list[Any], list[Any]]:
    """Fetch raw devices and normalized devices from the controller."""
    config = to_topology_config(credentials)
    raw_devices: list[dict[str, Any]] = list(fetch_devices(config, site=credentials.site))  # type: ignore[arg-type]
    devices = normalize_devices(raw_devices)
    return raw_devices, devices


def _build_mermaid_section(devices: list[Any]) -> DocumentationSection:
    """Build the Mermaid topology diagram section."""
    gateway_types = {"gateway", "udm", "ugw"}
    gateway_macs = [d.mac for d in devices if d.type in gateway_types]
    topology = build_topology(devices, include_ports=True, only_unifi=False, gateways=gateway_macs)
    edges = topology.tree_edges if topology.tree_edges else topology.raw_edges
    mermaid_src = render_mermaid(edges)
    content = f"```mermaid\n{mermaid_src}\n```"
    return DocumentationSection(
        id="mermaid-topology",
        title="Network Topology",
        content=content,
        item_count=len(edges),
    )


def _resolve_device_hostnames(devices: list[Any], credentials: UnifiCredentials) -> dict[str, str]:
    """Resolve hostnames for device IPs using the controller as DNS server."""
    try:
        from urllib.parse import urlparse
        dns_server = urlparse(credentials.url).hostname
        if not dns_server:
            return {}
        ips = [d.ip for d in devices if d.ip]
        return resolve_hostnames(ips, dns_server)
    except Exception:  # noqa: BLE001
        log.warning("hostname_resolution_failed")
        return {}


def _build_inventory_section(devices: list[Any], credentials: UnifiCredentials) -> DocumentationSection:
    """Build the device inventory table section."""
    hostnames = _resolve_device_hostnames(devices, credentials)
    inventory = build_device_inventory(devices, hostnames)
    content = render_device_inventory_table(inventory, include_hostname=True)
    data: list[dict[str, str | int | float | bool | None]] = [
        {
            "name": d.name, "type": d.device_type, "model": d.model_name, "ip": d.ip,
            "hostname": d.hostname, "mac": d.mac, "firmware": d.firmware,
        }
        for d in inventory
    ]
    return DocumentationSection(
        id="device-inventory",
        title="Device Inventory",
        content=content,
        item_count=len(inventory),
        data=data,
    )


def _build_port_data(devices: list[Any]) -> list[dict[str, str | int | float | bool | None]]:
    """Build structured port data for JSON export."""
    rows: list[dict[str, str | int | float | bool | None]] = []
    for d in devices:
        for p in d.port_table:
            rows.append({
                "device": d.name, "port": p.port_idx, "name": p.name or "",
                "speed": p.speed, "up": p.up, "poe": p.poe_enable,
                "poe_power": p.poe_power, "native_vlan": p.native_vlan,
            })
    return rows


def _build_port_overview_section(devices: list[Any]) -> DocumentationSection:
    """Build the device port overview section."""
    port_map = build_port_map(devices)
    content = render_device_port_overview(devices, port_map)
    return DocumentationSection(
        id="port-overview",
        title="Port Overview",
        content=content,
        item_count=len(devices),
        data=_build_port_data(devices),
    )


def _build_lldp_data(devices: list[Any]) -> list[dict[str, str | int | float | bool | None]]:
    """Build structured LLDP data for JSON export."""
    rows: list[dict[str, str | int | float | bool | None]] = []
    for d in devices:
        for entry in d.lldp_info:
            rows.append({
                "device": d.name, "local_port": entry.local_port_name,
                "local_port_idx": entry.local_port_idx,
                "chassis_id": entry.chassis_id, "port_id": entry.port_id,
                "port_desc": entry.port_desc,
            })
    return rows


def _build_lldp_section(devices: list[Any]) -> DocumentationSection:
    """Build the LLDP neighbor table section."""
    content = render_lldp_md(devices)
    lldp_count = sum(len(d.lldp_info) for d in devices)
    return DocumentationSection(
        id="lldp-neighbors",
        title="LLDP Neighbors",
        content=content,
        item_count=lldp_count,
        data=_build_lldp_data(devices),
    )


def _build_firewall_section(credentials: UnifiCredentials) -> DocumentationSection:
    """Build the firewall summary section from zone pairs."""
    zones = get_zones(credentials)
    zone_pairs = get_zone_pairs(credentials)
    zone_name_lookup = {z.id: z.name for z in zones}

    lines: list[str] = []
    lines.append(f"Total zone pairs: {len(zone_pairs)}\n")

    grade_counts: dict[str, int] = {}
    finding_counts: dict[str, int] = {}
    total_rules = 0

    for pair in zone_pairs:
        total_rules += len(pair.rules)
        if pair.analysis:
            grade = pair.analysis.grade
            grade_counts[grade] = grade_counts.get(grade, 0) + 1
            for finding in pair.analysis.findings:
                finding_counts[finding.severity] = finding_counts.get(finding.severity, 0) + 1

    lines.append(f"Total rules: {total_rules}\n")

    if grade_counts:
        lines.append("### Grade Distribution\n")
        lines.append("| Grade | Count |")
        lines.append("|-------|-------|")
        for grade in sorted(grade_counts):
            lines.append(f"| {grade} | {grade_counts[grade]} |")
        lines.append("")

    if finding_counts:
        lines.append("### Findings by Severity\n")
        lines.append("| Severity | Count |")
        lines.append("|----------|-------|")
        for severity in ("critical", "high", "medium", "low", "info"):
            if severity in finding_counts:
                lines.append(f"| {severity} | {finding_counts[severity]} |")
        lines.append("")

    if zone_pairs:
        lines.append("### Zone Pairs\n")
        lines.append("| Source | Destination | Rules | Allow | Block | Grade |")
        lines.append("|--------|-------------|-------|-------|-------|-------|")
        for pair in zone_pairs:
            src = zone_name_lookup.get(pair.source_zone_id, pair.source_zone_id)
            dst = zone_name_lookup.get(pair.destination_zone_id, pair.destination_zone_id)
            grade = pair.analysis.grade if pair.analysis else "-"
            lines.append(f"| {src} | {dst} | {len(pair.rules)} | {pair.allow_count} | {pair.block_count} | {grade} |")
        lines.append("")

    content = "\n".join(lines)
    data: list[dict[str, str | int | float | bool | None]] = [
        {
            "source": zone_name_lookup.get(p.source_zone_id, p.source_zone_id),
            "destination": zone_name_lookup.get(p.destination_zone_id, p.destination_zone_id),
            "rules": len(p.rules), "allow": p.allow_count, "block": p.block_count,
            "grade": p.analysis.grade if p.analysis else None,
            "score": p.analysis.score if p.analysis else None,
        }
        for p in zone_pairs
    ]
    return DocumentationSection(
        id="firewall-summary",
        title="Firewall Summary",
        content=content,
        item_count=len(zone_pairs),
        data=data,
    )


def _build_metrics_section(credentials: UnifiCredentials) -> DocumentationSection:
    """Build the metrics snapshot section from the metrics database."""
    try:
        config = to_topology_config(credentials)
        raw_stats: list[dict[str, Any]] = list(fetch_device_stats(config, site=credentials.site))  # type: ignore[arg-type]
        stats = normalize_device_stats(raw_stats)
    except Exception:  # noqa: BLE001
        stats = None
    snapshots = get_latest_snapshots(stats)

    if not snapshots:
        return DocumentationSection(
            id="metrics-snapshot",
            title="Metrics Snapshot",
            content="No metrics data available.",
            item_count=0,
        )

    lines: list[str] = []
    lines.append("| Device | Type | CPU | Memory | Uptime (h) | Clients | Status |")
    lines.append("|--------|------|-----|--------|------------|---------|--------|")
    for snap in snapshots:
        uptime_hours = snap.uptime // 3600 if snap.uptime else 0
        lines.append(
            f"| {snap.name} | {snap.type} | {snap.cpu:.1f}% | {snap.mem:.1f}% "
            f"| {uptime_hours} | {snap.num_sta} | {snap.status} |"
        )
    lines.append("")

    content = "\n".join(lines)
    data: list[dict[str, str | int | float | bool | None]] = [
        {
            "name": s.name, "type": s.type, "cpu": round(s.cpu, 1), "mem": round(s.mem, 1),
            "uptime_hours": s.uptime // 3600 if s.uptime else 0,
            "clients": s.num_sta, "status": s.status,
        }
        for s in snapshots
    ]
    return DocumentationSection(
        id="metrics-snapshot",
        title="Metrics Snapshot",
        content=content,
        item_count=len(snapshots),
        data=data,
    )


def get_documentation_sections(credentials: UnifiCredentials) -> list[DocumentationSection]:
    """Generate all documentation sections from controller data."""
    _raw_devices, devices = _fetch_controller_data(credentials)

    sections = [
        _build_mermaid_section(devices),
        _build_inventory_section(devices, credentials),
        _build_port_overview_section(devices),
        _build_lldp_section(devices),
        _build_firewall_section(credentials),
        _build_metrics_section(credentials),
    ]

    log.info("documentation_sections_generated", section_count=len(sections))
    return sections


def get_documentation_export(credentials: UnifiCredentials) -> str:
    """Generate a single Markdown document from all sections."""
    sections = get_documentation_sections(credentials)

    parts: list[str] = ["# Network Documentation\n"]
    for section in sections:
        parts.append(f"## {section.title}\n")
        parts.append(section.content)
        parts.append("")

    document = "\n".join(parts)
    log.info("documentation_export_generated", length=len(document))
    return document
