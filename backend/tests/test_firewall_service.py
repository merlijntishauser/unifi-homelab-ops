from unittest.mock import patch

from unifi_topology import Config

from app.config import UnifiCredentials
from app.services.firewall import _build_network_lookup, get_zone_pairs, to_topology_config

MOCK_CREDS = UnifiCredentials(url="https://x", username="u", password="p")


def _config() -> Config:
    return Config(url="https://x", site="default", user="u", password="p", verify_ssl=False)


class TestToTopologyConfig:
    def test_password_credentials(self) -> None:
        config = to_topology_config(UnifiCredentials(url="https://x", username="u", password="p"))
        assert config.user == "u"
        assert config.password == "p"
        assert config.api_key is None

    def test_api_key_credentials(self) -> None:
        config = to_topology_config(UnifiCredentials(url="https://x", api_key="k"))
        assert config.api_key == "k"
        assert config.user is None
        assert config.password is None


class TestBuildNetworkLookup:
    def test_non_dict_entries_are_skipped(self) -> None:
        with patch("app.services.firewall.fetch_networks", return_value=["not-a-dict", 42]):
            lookup = _build_network_lookup(_config())
        assert lookup == {}

    def test_dict_without_id_is_skipped(self) -> None:
        with patch("app.services.firewall.fetch_networks", return_value=[{"name": "orphan"}]):
            lookup = _build_network_lookup(_config())
        assert lookup == {}


class TestGetZonePairs:
    def test_includes_uncovered_zone_pairs(self) -> None:
        """Zone combinations with no rules should still appear in the output."""
        mock_zones = [
            {"_id": "z1", "name": "LAN", "networkIds": []},
            {"_id": "z2", "name": "WAN", "networkIds": []},
        ]
        # One rule covers z1->z2, leaving z1->z1, z2->z1, z2->z2 uncovered
        mock_policies = [
            {"_id": "r1", "name": "Allow", "enabled": True, "action": "ALLOW",
             "source_zone_id": "z1", "destination_zone_id": "z2", "index": 100},
        ]
        with (
            patch("app.services.firewall.fetch_firewall_zones", return_value=mock_zones),
            patch("app.services.firewall.fetch_firewall_policies", return_value=mock_policies),
            patch("app.services.firewall.fetch_networks", return_value=[]),
            patch("app.services.firewall.fetch_firewall_groups", return_value=[]),
        ):
            pairs = get_zone_pairs(MOCK_CREDS)

        # 2 zones x 2 zones = 4 pairs
        assert len(pairs) == 4
        pair_keys = {(p.source_zone_id, p.destination_zone_id) for p in pairs}
        assert pair_keys == {("z1", "z1"), ("z1", "z2"), ("z2", "z1"), ("z2", "z2")}

        # The pair with a rule should have it
        z1_z2 = next(p for p in pairs if p.source_zone_id == "z1" and p.destination_zone_id == "z2")
        assert len(z1_z2.rules) == 1
        assert z1_z2.allow_count == 1

        # Uncovered pairs should have no rules and the "no-explicit-rules" finding
        z2_z1 = next(p for p in pairs if p.source_zone_id == "z2" and p.destination_zone_id == "z1")
        assert len(z2_z1.rules) == 0
        assert z2_z1.allow_count == 0
        assert z2_z1.block_count == 0
        assert z2_z1.analysis is not None
        finding_ids = [f.id for f in z2_z1.analysis.findings]
        assert "no-explicit-rules" in finding_ids


class TestPolicyToRuleDomainMatching:
    """Domain/application criteria must survive normalization into `Rule`.

    Without these the analyzer cannot tell a domain allowlist from a rule that
    genuinely allows everything (unifi-topology#68).
    """

    def test_domain_and_app_criteria_are_carried_over(self) -> None:
        from unifi_topology import FirewallPolicy

        from app.services.firewall import _policy_to_rule

        policy = FirewallPolicy(
            id="p1",
            name="IoT Domain Whitelist",
            enabled=True,
            action="ALLOW",
            source_zone_id="iot",
            destination_zone_id="wan",
            protocol="all",
            destination_matching_target="WEB",
            destination_web_domains=("example.com", "ntp.org"),
            destination_web_matching_type="DOMAIN",
            destination_app_ids=("4-6",),
            source_matching_target="ANY",
        )

        rule = _policy_to_rule(policy, {})

        assert rule.destination_web_domains == ["example.com", "ntp.org"]
        assert rule.destination_app_ids == ["4-6"]
        assert rule.destination_matching_target == "WEB"
        assert rule.destination_web_matching_type == "DOMAIN"
        assert rule.source_matching_target == "ANY"

    def test_defaults_stay_empty_for_an_unrestricted_policy(self) -> None:
        from unifi_topology import FirewallPolicy

        from app.services.firewall import _policy_to_rule

        rule = _policy_to_rule(
            FirewallPolicy(
                id="p2",
                name="Allow All",
                enabled=True,
                action="ALLOW",
                source_zone_id="lan",
                destination_zone_id="wan",
                protocol="all",
            ),
            {},
        )

        assert rule.destination_web_domains == []
        assert rule.destination_app_ids == []
        assert rule.destination_matching_target == ""
