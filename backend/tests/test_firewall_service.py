from unittest.mock import patch

from unifi_topology import Config

from app.config import UnifiCredentials
from app.services.firewall import _build_network_lookup, get_zone_pairs

MOCK_CREDS = UnifiCredentials(url="https://x", username="u", password="p")


def _config() -> Config:
    return Config(url="https://x", site="default", user="u", password="p", verify_ssl=False)


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
