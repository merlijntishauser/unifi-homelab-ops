"""Tests for static firewall rule analyzer."""

from app.models import Rule
from app.services.analyzer import analyze_zone_pair, compute_grade


def _rule(
    *,
    rule_id: str = "r1",
    name: str = "Test Rule",
    enabled: bool = True,
    action: str = "ALLOW",
    source_zone_id: str = "zone-src",
    destination_zone_id: str = "zone-dst",
    protocol: str = "all",
    port_ranges: list[str] | None = None,
    ip_ranges: list[str] | None = None,
    index: int = 100,
    predefined: bool = False,
    source_ip_ranges: list[str] | None = None,
    source_mac_addresses: list[str] | None = None,
    source_port_ranges: list[str] | None = None,
    source_network_id: str = "",
    destination_mac_addresses: list[str] | None = None,
    destination_network_id: str = "",
    source_port_group_members: list[str] | None = None,
    destination_port_group_members: list[str] | None = None,
    source_address_group: str = "",
    source_address_group_members: list[str] | None = None,
    destination_address_group: str = "",
    destination_address_group_members: list[str] | None = None,
    source_matching_target: str = "",
    destination_matching_target: str = "",
    destination_web_domains: list[str] | None = None,
    destination_web_matching_type: str = "",
    destination_app_ids: list[str] | None = None,
    connection_state_type: str = "",
    connection_logging: bool = False,
    schedule: str = "",
    match_ip_sec: str = "",
) -> Rule:
    return Rule(
        id=rule_id,
        name=name,
        enabled=enabled,
        action=action,
        source_zone_id=source_zone_id,
        destination_zone_id=destination_zone_id,
        protocol=protocol,
        port_ranges=port_ranges or [],
        ip_ranges=ip_ranges or [],
        index=index,
        predefined=predefined,
        source_ip_ranges=source_ip_ranges or [],
        source_mac_addresses=source_mac_addresses or [],
        source_port_ranges=source_port_ranges or [],
        source_network_id=source_network_id,
        destination_mac_addresses=destination_mac_addresses or [],
        destination_network_id=destination_network_id,
        source_port_group_members=source_port_group_members or [],
        destination_port_group_members=destination_port_group_members or [],
        source_address_group=source_address_group,
        source_address_group_members=source_address_group_members or [],
        destination_address_group=destination_address_group,
        destination_address_group_members=destination_address_group_members or [],
        source_matching_target=source_matching_target,
        destination_matching_target=destination_matching_target,
        destination_web_domains=destination_web_domains or [],
        destination_web_matching_type=destination_web_matching_type,
        destination_app_ids=destination_app_ids or [],
        connection_state_type=connection_state_type,
        connection_logging=connection_logging,
        schedule=schedule,
        match_ip_sec=match_ip_sec,
    )


class TestComputeGrade:
    def test_perfect_score(self) -> None:
        assert compute_grade(100) == "A"

    def test_a_grade(self) -> None:
        assert compute_grade(90) == "A"

    def test_b_grade(self) -> None:
        assert compute_grade(80) == "B"
        assert compute_grade(89) == "B"

    def test_c_grade(self) -> None:
        assert compute_grade(65) == "C"
        assert compute_grade(79) == "C"

    def test_d_grade(self) -> None:
        assert compute_grade(50) == "D"
        assert compute_grade(64) == "D"

    def test_f_grade(self) -> None:
        assert compute_grade(49) == "F"
        assert compute_grade(0) == "F"


class TestAnalyzeZonePair:
    def test_no_rules_returns_low_finding(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert any(f.id == "no-explicit-rules" for f in result.findings)
        assert result.score <= 100

    def test_allow_all_protocols_ports_high(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "allow-all-protocols-ports" for f in result.findings)
        assert any(f.severity == "high" for f in result.findings)

    def test_allow_with_port_restriction_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_from_external(self) -> None:
        rules = [_rule(source_zone_id="zone-ext", protocol="all")]
        result = analyze_zone_pair(rules, "External", "DMZ")
        assert any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_from_external_not_triggered_for_non_external(self) -> None:
        rules = [_rule(protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_external_to_internal(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_ip_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=["10.0.0.5"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_source_ip_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"], source_ip_ranges=["203.0.113.10/32"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_destination_network_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"], destination_network_id="net-dmz")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_disabled_block_rule(self) -> None:
        rules = [_rule(enabled=False, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_disabled_drop_rule(self) -> None:
        rules = [_rule(enabled=False, action="DROP")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_enabled_block_rule_no_finding(self) -> None:
        rules = [_rule(enabled=True, action="BLOCK", connection_logging=True)]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "disabled-block-rule" for f in result.findings)

    def test_shadowed_rule(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        shadowed = [f for f in result.findings if f.id == "shadowed-rule"]
        assert len(shadowed) == 1
        assert shadowed[0].rule_id == "r2"

    def test_allow_shadowing_a_block_is_high_severity(self) -> None:
        """The dead rule is a BLOCK: traffic the operator believes is blocked
        is accepted. (This test was previously named "no_shadow_when_different
        _actions" while asserting the opposite.)"""
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "shadowed-rule")
        assert finding.severity == "high"
        assert "protects nothing" in finding.description

    def test_block_shadowing_an_allow_is_medium_severity(self) -> None:
        """The dead rule is an ALLOW: a loud outage, not a silent gap."""
        rules = [
            _rule(rule_id="r1", action="BLOCK", protocol="all", port_ranges=[], index=100, connection_logging=True),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["443"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "shadowed-rule")
        assert finding.severity == "medium"
        assert "unreachable" in finding.description

    def test_same_action_shadow_is_low_severity_redundancy(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "shadowed-rule")
        assert finding.severity == "low"
        assert finding.title == "Redundant rule"

    def test_domain_restricted_allow_does_not_shadow_a_block(self) -> None:
        """The e2e mock scenario, previously a false positive: a domain
        whitelist matches only its domains, so traffic to anything else falls
        through to the block -- which therefore absolutely executes."""
        rules = [
            _rule(
                rule_id="r1", name="IoT Domain Whitelist", action="ALLOW",
                protocol="all", port_ranges=[], index=100,
                destination_matching_target="WEB",
                destination_web_matching_type="DOMAIN",
                destination_web_domains=["updates.example.com"],
            ),
            _rule(rule_id="r2", name="Block Rest", action="BLOCK", protocol="all",
                  port_ranges=[], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_unconstrained_allow_still_shadows_a_domain_restricted_rule(self) -> None:
        """The guard must not break the true-positive direction."""
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(
                rule_id="r2", action="ALLOW", protocol="all", port_ranges=[], index=200,
                destination_matching_target="WEB",
                destination_web_domains=["updates.example.com"],
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" for f in result.findings)

    def test_matching_target_any_is_unconstrained_for_shadowing(self) -> None:
        """The controller writes ANY for un-narrowed rules; it must cover,
        not compare as a literal that never equals an empty field."""
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100,
                  source_matching_target="ANY", destination_matching_target="ANY"),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" for f in result.findings)

    def test_wide_port_range(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["1-65535"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "wide-port-range" for f in result.findings)

    def test_narrow_port_range_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80-443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_predefined_rules_reported_as_informational(self) -> None:
        rules = [_rule(predefined=True, protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["predefined-unreviewed"]
        assert result.score == 98

    def test_multiple_predefined_rules_reported_once(self) -> None:
        rules = [
            _rule(rule_id="r1", predefined=True),
            _rule(rule_id="r2", predefined=True, name="Built-in Allow"),
        ]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["predefined-unreviewed"]
        assert result.score == 98

    def test_score_deductions(self) -> None:
        # One high finding = -15
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "WAN")
        assert result.score < 100

    def test_score_clamped_to_zero(self) -> None:
        # Many high findings should not go below 0
        rules = [
            _rule(rule_id=f"r{i}", protocol="all", port_ranges=[], index=i)
            for i in range(20)
        ]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert result.score >= 0

    def test_grade_returned(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert result.grade in ("A", "B", "C", "D", "F")

    def test_finding_has_source_static(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert all(f.source == "static" for f in result.findings)

    def test_malformed_port_range(self) -> None:
        """Malformed port range like 'abc-def' should not crash."""
        rules = [_rule(protocol="tcp", port_ranges=["abc-def"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_no_shadow_when_different_port_ranges(self) -> None:
        """Rules with same action/protocol but different port ranges are not shadowed."""
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["80"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["443"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_return_traffic_rule_not_flagged_as_allow_all_external(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_return_traffic_rule_not_flagged_as_allow_all_protocols(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_not_flagged_when_narrowed_to_a_host(self) -> None:
        """A rule pinned to one host is an exception, not an unrestricted allow."""
        rules = [_rule(protocol="all", port_ranges=[], ip_ranges=["192.168.30.10/32"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_not_flagged_when_narrowed_to_an_address_group(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[], destination_address_group_members=["10.0.0.5"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_not_flagged_when_narrowed_to_a_mac(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[], destination_mac_addresses=["aa:bb:cc:dd:ee:ff"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_still_flagged_when_truly_unrestricted(self) -> None:
        """The guard must not silence the case the check exists for."""
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_not_flagged_when_restricted_to_domains(self) -> None:
        """A domain allowlist constrains the destination, not the service."""
        rules = [_rule(protocol="all", port_ranges=[], destination_web_domains=["example.com"])]
        result = analyze_zone_pair(rules, "IoT", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_ports_not_flagged_when_restricted_to_apps(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[], destination_app_ids=["4-6"])]
        result = analyze_zone_pair(rules, "IoT", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_matching_target_covers_criteria_we_do_not_decode(self) -> None:
        """A non-ANY target means narrowed even when no criteria list is populated.

        Regions and app categories are not decoded into fields, so without this
        signal such a rule would still read as unrestricted.
        """
        rules = [_rule(protocol="all", port_ranges=[], destination_matching_target="REGION")]
        result = analyze_zone_pair(rules, "IoT", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_matching_target_any_is_not_a_restriction(self) -> None:
        """ANY is the controller's default and must not suppress the finding."""
        for value in ("ANY", "any"):
            rules = [_rule(protocol="all", port_ranges=[], destination_matching_target=value)]
            result = analyze_zone_pair(rules, "IoT", "WAN")
            assert any(f.id == "allow-all-protocols-ports" for f in result.findings), value

    def test_return_traffic_rule_not_flagged_as_external_to_internal(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_connection_state_return_rule_not_flagged_as_external_to_internal(self) -> None:
        rules = [_rule(name="Allow App", protocol="tcp", port_ranges=["80"], connection_state_type="established")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_established_keyword_detected(self) -> None:
        rules = [_rule(name="Allow Established", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_related_keyword_detected(self) -> None:
        rules = [_rule(name="Allow Related Sessions", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_non_return_traffic_still_flagged(self) -> None:
        rules = [_rule(name="Allow All Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "External", "DMZ")
        assert any(f.id == "allow-all-external" for f in result.findings)

    def test_stateful_name_is_not_treated_as_return_traffic(self) -> None:
        rules = [_rule(name="Allow Stateful App", protocol="all")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_no_shadow_when_earlier_has_ip_ranges(self) -> None:
        """Earlier rule with ip_ranges does not shadow a later rule."""
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                port_ranges=[],
                ip_ranges=["10.0.0.0/8"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_source_ip_ranges(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                source_ip_ranges=["10.0.0.5"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_destination_network(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                destination_network_id="net-dmz",
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_connection_state_restriction(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                connection_state_type="established",
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_shadow_when_earlier_port_range_covers_later_port(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["1-1024"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_no_shadow_when_earlier_port_restriction_does_not_cover_unrestricted_later(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["80"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=[], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_invalid_port_constraint(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                destination_port_group_members=["abc"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_invalid_port_range(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["100-10"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_malformed_port_range(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["abc-def"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_blank_port_constraint(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                destination_port_group_members=[" "],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_shadow_when_matching_source_ip_restrictions(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                source_ip_ranges=["10.0.0.5"],
                index=100,
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                source_ip_ranges=["10.0.0.5"],
                index=200,
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_shadow_when_matching_destination_network(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                destination_network_id="net-dmz",
                index=100,
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                destination_network_id="net-dmz",
                index=200,
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_unrestricted_external_to_internal_reports_specific_findings(self) -> None:
        rules = [_rule(name="Allow All Inbound", protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["allow-external-to-internal", "no-connection-state"]
        assert result.score == 83

    def test_findings_have_rationale(self) -> None:
        """All findings from the analyzer should have a non-empty rationale."""
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        for finding in result.findings:
            assert finding.rationale, f"Finding '{finding.id}' has no rationale"


class TestNoConnectionState:
    def test_allow_without_state_tracking(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "no-connection-state" for f in result.findings)

    def test_allow_with_state_tracking_no_finding(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"], connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_return_traffic_rule_not_flagged(self) -> None:
        rules = [_rule(name="Allow Return Traffic", action="ALLOW", protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_established_state_not_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="all", connection_state_type="established")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_block_rule_not_flagged(self) -> None:
        rules = [_rule(action="BLOCK", protocol="tcp", port_ranges=["80"], connection_logging=True)]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_reported_once_per_pair_not_once_per_rule(self) -> None:
        """Per-rule reporting let this one finding dominate the whole score."""
        rules = [
            _rule(rule_id="a", name="A", protocol="tcp", port_ranges=["443"]),
            _rule(rule_id="b", name="B", protocol="udp", port_ranges=["53"]),
            _rule(rule_id="c", name="C", protocol="tcp", port_ranges=["22"]),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        matches = [f for f in result.findings if f.id == "no-connection-state"]
        assert len(matches) == 1

    def test_lists_every_affected_rule(self) -> None:
        rules = [
            _rule(rule_id="a", name="Web", protocol="tcp", port_ranges=["443"]),
            _rule(rule_id="b", name="DNS", protocol="udp", port_ranges=["53"]),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "no-connection-state")
        assert finding.rule_ids == ["a", "b"]
        assert "'Web'" in finding.description
        assert "'DNS'" in finding.description

    def test_excludes_rules_that_do_set_state(self) -> None:
        rules = [
            _rule(rule_id="a", name="Stateless", protocol="tcp", port_ranges=["443"]),
            _rule(rule_id="b", name="Stateful", protocol="tcp", port_ranges=["22"], connection_state_type="new"),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "no-connection-state")
        assert finding.rule_ids == ["a"]

    def test_a_tight_ruleset_does_not_collapse_the_score(self) -> None:
        """Five well-scoped allow rules previously scored 0/F on this finding alone."""
        rules = [
            _rule(rule_id=f"r{i}", name=f"R{i}", protocol="tcp", port_ranges=[str(440 + i)])
            for i in range(5)
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert result.score >= 90
        assert result.grade == "A"

    def test_disabled_rule_not_flagged(self) -> None:
        rules = [_rule(enabled=False, action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_severity_is_low(self) -> None:
        """Hardening advice, not a vulnerability: it must not dominate the score."""
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "no-connection-state")
        assert finding.severity == "low"


class TestOverlappingAllowBlock:
    def test_allow_then_narrower_block_flags_overlap(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["1-1024"],
                index=100,
                connection_state_type="new",
            ),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        overlapping = [f for f in result.findings if f.id == "overlapping-allow-block"]
        assert len(overlapping) == 1
        assert overlapping[0].rule_id == "r2"

    def test_block_then_narrower_allow_flags_overlap(self) -> None:
        rules = [
            _rule(
                rule_id="r1", action="BLOCK", protocol="tcp",
                port_ranges=["80-443"], index=100, connection_logging=True,
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["1-1024"],
                index=200,
                connection_state_type="new",
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "overlapping-allow-block" for f in result.findings)

    def test_same_action_no_overlap(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["1-1024"],
                index=100,
                connection_state_type="new",
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                index=200,
                connection_state_type="new",
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "overlapping-allow-block" for f in result.findings)

    def test_different_protocols_no_overlap(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                index=100,
                connection_state_type="new",
            ),
            _rule(rule_id="r2", action="BLOCK", protocol="udp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "overlapping-allow-block" for f in result.findings)

    def test_full_shadow_not_flagged_as_overlap(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "shadowed-rule" for f in result.findings)
        assert not any(f.id == "overlapping-allow-block" for f in result.findings)

    def test_domain_carve_out_is_low_severity(self) -> None:
        """Allow specific domains, block the rest: the canonical whitelist.

        Nothing is dead (the block handles all non-whitelisted traffic) and
        nothing is ambiguous (the exception is a strict subset), so a medium
        "review this ordering" every time would punish the correct pattern.
        """
        rules = [
            _rule(
                rule_id="r1", name="IoT Domain Whitelist", action="ALLOW",
                protocol="all", port_ranges=[], index=100,
                destination_matching_target="WEB",
                destination_web_matching_type="DOMAIN",
                destination_web_domains=["updates.example.com"],
            ),
            _rule(rule_id="r2", name="Block Rest", action="BLOCK", protocol="all",
                  port_ranges=[], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "overlapping-allow-block")
        assert finding.severity == "low"
        assert finding.title == "Exception rule ahead of a broader rule"
        assert "carves an exception" in finding.description

    def test_port_carve_out_is_low_severity(self) -> None:
        """Allow tcp/443, then block every tcp port: same exception shape."""
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["443"], index=100),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=[], index=200,
                  connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "overlapping-allow-block")
        assert finding.severity == "low"

    def test_block_exception_above_broader_allow_is_also_a_carve_out(self) -> None:
        """Block SSH, allow the other ports: the same pattern with actions
        reversed -- the ordering is the only way to express it."""
        rules = [
            _rule(rule_id="r1", action="BLOCK", protocol="tcp", port_ranges=["22"], index=100,
                  connection_logging=True),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=[], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        finding = next(f for f in result.findings if f.id == "overlapping-allow-block")
        assert finding.severity == "low"

    def test_severity_is_medium(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["1-1024"],
                index=100,
                connection_state_type="new",
            ),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "overlapping-allow-block")
        assert finding.severity == "medium"

    def test_no_port_constraint_means_overlap(self) -> None:
        """When one rule has ports and the other has none, they overlap (no port = all ports)."""
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                index=100,
                connection_state_type="new",
            ),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=[], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "overlapping-allow-block" for f in result.findings)

    def test_unparseable_port_constraint_no_overlap(self) -> None:
        """When port constraints are unparseable, no overlap is flagged."""
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                destination_port_group_members=["abc"],
                index=100,
                connection_state_type="new",
            ),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200, connection_logging=True),
        ]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "overlapping-allow-block" for f in result.findings)


class TestBroadAddressGroup:
    def test_source_group_with_any_address(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            source_address_group="AllHosts", source_address_group_members=["0.0.0.0/0"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "broad-address-group" for f in result.findings)

    def test_destination_group_with_any_address(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            destination_address_group="AllHosts", destination_address_group_members=["0.0.0.0/0"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "broad-address-group" for f in result.findings)

    def test_ipv6_any_address_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            source_address_group="AllV6", source_address_group_members=["::/0"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "broad-address-group" for f in result.findings)

    def test_any_keyword_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            destination_address_group="Any", destination_address_group_members=["any"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "broad-address-group" for f in result.findings)

    def test_specific_addresses_not_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            source_address_group="Servers", source_address_group_members=["10.0.1.5", "10.0.1.6"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "broad-address-group" for f in result.findings)

    def test_block_rule_not_flagged(self) -> None:
        rules = [_rule(action="BLOCK", source_address_group="All", source_address_group_members=["0.0.0.0/0"],
            connection_logging=True)]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "broad-address-group" for f in result.findings)

    def test_disabled_rule_not_flagged(self) -> None:
        rules = [_rule(enabled=False, action="ALLOW", source_address_group="All",
            source_address_group_members=["0.0.0.0/0"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "broad-address-group" for f in result.findings)

    def test_severity_is_medium(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            source_address_group="All", source_address_group_members=["0.0.0.0/0"],
            connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "broad-address-group")
        assert finding.severity == "medium"


class TestMissingBlockLogging:
    def test_block_without_logging(self) -> None:
        rules = [_rule(action="BLOCK", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "missing-block-logging" for f in result.findings)

    def test_reject_without_logging(self) -> None:
        rules = [_rule(action="REJECT", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "missing-block-logging" for f in result.findings)

    def test_block_with_logging_no_finding(self) -> None:
        rules = [_rule(action="BLOCK", protocol="tcp", port_ranges=["80"], connection_logging=True)]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "missing-block-logging" for f in result.findings)

    def test_allow_rule_not_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["80"], connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "missing-block-logging" for f in result.findings)

    def test_disabled_block_not_flagged(self) -> None:
        rules = [_rule(enabled=False, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "missing-block-logging" for f in result.findings)

    def test_severity_is_low(self) -> None:
        rules = [_rule(action="BLOCK", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "missing-block-logging")
        assert finding.severity == "low"


class TestScheduleDependentAllow:
    def test_allow_with_schedule(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            schedule="office-hours", connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "schedule-dependent-allow" for f in result.findings)

    def test_allow_without_schedule_no_finding(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"], connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "schedule-dependent-allow" for f in result.findings)

    def test_block_with_schedule_not_flagged(self) -> None:
        rules = [_rule(action="BLOCK", schedule="office-hours", connection_logging=True)]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "schedule-dependent-allow" for f in result.findings)

    def test_disabled_rule_not_flagged(self) -> None:
        rules = [_rule(enabled=False, action="ALLOW", schedule="office-hours")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "schedule-dependent-allow" for f in result.findings)

    def test_severity_is_low(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"],
            schedule="weekdays", connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "schedule-dependent-allow")
        assert finding.severity == "low"
