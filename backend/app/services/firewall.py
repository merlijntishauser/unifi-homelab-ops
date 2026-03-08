"""Firewall data service.

Provides zone, rule, and zone-pair data from the UniFi controller.
"""

from app.config import UnifiCredentials
from app.models import Network, Rule, Zone, ZonePair

# TODO: Replace mock data with real UniFi controller API calls via unifi-topology
# once that library supports firewall data fetching.


def _mock_zones() -> list[Zone]:
    """Return hardcoded zones representing a typical UniFi setup."""
    return [
        Zone(
            id="zone-external",
            name="External",
            networks=[
                Network(id="net-wan", name="WAN", subnet=None),
            ],
        ),
        Zone(
            id="zone-internal",
            name="Internal",
            networks=[
                Network(id="net-lan", name="LAN", vlan_id=1, subnet="192.168.1.0/24"),
            ],
        ),
        Zone(
            id="zone-guest",
            name="Guest",
            networks=[
                Network(id="net-guest", name="Guest WiFi", vlan_id=100, subnet="10.0.100.0/24"),
            ],
        ),
        Zone(
            id="zone-iot",
            name="IoT",
            networks=[
                Network(id="net-iot", name="IoT Devices", vlan_id=200, subnet="10.0.200.0/24"),
            ],
        ),
        Zone(
            id="zone-vpn",
            name="VPN",
            networks=[
                Network(id="net-vpn", name="VPN Clients", subnet="10.10.0.0/24"),
            ],
        ),
        Zone(
            id="zone-gateway",
            name="Gateway",
            networks=[
                Network(id="net-gw", name="Gateway", subnet="192.168.1.1/32"),
            ],
        ),
    ]


def _mock_rules() -> list[Rule]:
    """Return hardcoded rules representing a typical UniFi firewall config."""
    return [
        # LAN -> WAN: allow all
        Rule(
            id="rule-1",
            name="Allow LAN to Internet",
            description="Allow all traffic from LAN to WAN",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-internal",
            destination_zone_id="zone-external",
            index=100,
        ),
        # Guest -> WAN: allow HTTP/HTTPS only
        Rule(
            id="rule-2",
            name="Allow Guest Web Access",
            description="Allow Guest zone to access web on WAN",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-guest",
            destination_zone_id="zone-external",
            protocol="tcp",
            port_ranges=["80", "443"],
            index=200,
        ),
        # Guest -> WAN: allow DNS
        Rule(
            id="rule-3",
            name="Allow Guest DNS",
            description="Allow Guest zone to resolve DNS",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-guest",
            destination_zone_id="zone-external",
            protocol="udp",
            port_ranges=["53"],
            index=210,
        ),
        # Guest -> WAN: block everything else
        Rule(
            id="rule-4",
            name="Block Guest Other Traffic",
            description="Block all other Guest traffic to WAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="zone-guest",
            destination_zone_id="zone-external",
            index=290,
        ),
        # IoT -> LAN: block
        Rule(
            id="rule-5",
            name="Block IoT to LAN",
            description="Prevent IoT devices from reaching LAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="zone-iot",
            destination_zone_id="zone-internal",
            index=300,
        ),
        # IoT -> WAN: allow
        Rule(
            id="rule-6",
            name="Allow IoT to Internet",
            description="Allow IoT devices to reach the internet",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-iot",
            destination_zone_id="zone-external",
            index=310,
        ),
        # Guest -> LAN: block
        Rule(
            id="rule-7",
            name="Block Guest to LAN",
            description="Prevent Guest from reaching LAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="zone-guest",
            destination_zone_id="zone-internal",
            index=400,
        ),
        # VPN -> LAN: allow
        Rule(
            id="rule-8",
            name="Allow VPN to LAN",
            description="Allow VPN clients to access LAN resources",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-vpn",
            destination_zone_id="zone-internal",
            index=500,
        ),
        # LAN -> IoT: allow
        Rule(
            id="rule-9",
            name="Allow LAN to IoT",
            description="Allow LAN to manage IoT devices",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-internal",
            destination_zone_id="zone-iot",
            index=600,
        ),
        # LAN -> Gateway: allow management (disabled example)
        Rule(
            id="rule-10",
            name="Allow LAN to Gateway SSH",
            description="Allow SSH access to gateway from LAN",
            enabled=False,
            action="ALLOW",
            source_zone_id="zone-internal",
            destination_zone_id="zone-gateway",
            protocol="tcp",
            port_ranges=["22"],
            index=700,
        ),
        # External -> Internal: block (predefined)
        Rule(
            id="rule-predefined-1",
            name="Block WAN to LAN",
            description="Default block inbound from WAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="zone-external",
            destination_zone_id="zone-internal",
            index=9000,
            predefined=True,
        ),
    ]


def get_zones(credentials: UnifiCredentials) -> list[Zone]:
    """Fetch zones from the UniFi controller.

    TODO: Replace with real API call using credentials to connect to the controller.
    """
    _ = credentials  # will be used when connecting to real controller
    return _mock_zones()


def get_rules(credentials: UnifiCredentials) -> list[Rule]:
    """Fetch firewall rules from the UniFi controller.

    TODO: Replace with real API call using credentials to connect to the controller.
    """
    _ = credentials  # will be used when connecting to real controller
    return _mock_rules()


def get_zone_pairs(credentials: UnifiCredentials) -> list[ZonePair]:
    """Build zone pairs with their associated rules.

    TODO: Replace with real API call using credentials to connect to the controller.
    """
    _ = credentials  # will be used when connecting to real controller
    rules = _mock_rules()

    # Group rules by (source_zone_id, destination_zone_id)
    pairs: dict[tuple[str, str], list[Rule]] = {}
    for rule in rules:
        key = (rule.source_zone_id, rule.destination_zone_id)
        pairs.setdefault(key, []).append(rule)

    return [
        ZonePair(
            source_zone_id=src,
            destination_zone_id=dst,
            rules=sorted(pair_rules, key=lambda r: r.index),
            allow_count=sum(1 for r in pair_rules if r.action == "ALLOW" and r.enabled),
            block_count=sum(1 for r in pair_rules if r.action in ("BLOCK", "REJECT") and r.enabled),
        )
        for (src, dst), pair_rules in pairs.items()
    ]
