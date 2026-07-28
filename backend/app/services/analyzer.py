"""Static firewall rule analyzer.

Analyzes zone pair rules for security risks and computes a posture score.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models import Rule
from app.services._rule_coverage import (
    destination_port_constraints,
    has_port_restrictions,
    port_ranges_overlap,
    protocol_covers,
    rule_shadows,
)

DEDUCTIONS = {"high": 15, "medium": 8, "low": 2}

_EXTERNAL_NAMES = {"external", "wan", "internet"}
_INTERNAL_NAMES = {"internal", "lan", "default"}
_BLOCK_ACTIONS = {"BLOCK", "REJECT", "DROP"}
_RETURN_TRAFFIC_KEYWORDS = {"return", "established", "related"}
_RETURN_TRAFFIC_STATES = {"return", "established", "related"}


@dataclass
class Finding:
    id: str
    severity: str  # "high", "medium", "low"
    title: str
    description: str
    rationale: str = ""
    rule_id: str | None = None
    rule_ids: list[str] = field(default_factory=list)
    source: str = "static"


@dataclass
class AnalysisResult:
    score: int
    grade: str
    findings: list[Finding] = field(default_factory=list)


def compute_grade(score: int) -> str:
    """Map a numeric score (0-100) to a letter grade."""
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 65:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _is_external(zone_name: str) -> bool:
    return zone_name.lower() in _EXTERNAL_NAMES


def _is_internal(zone_name: str) -> bool:
    return zone_name.lower() in _INTERNAL_NAMES


def _tokenize(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.lower()))


def _has_matching_target(rule: Rule) -> bool:
    """Whether the controller reports the rule narrowed by a matching target.

    `*_matching_target` is the general signal rather than the decoded criteria:
    anything other than "ANY" means the endpoint is constrained, so criteria the
    model does not decode into a list (regions, app categories) still do not read
    as unrestricted.
    """
    targets = (rule.source_matching_target, rule.destination_matching_target)
    return any(target and target.upper() != "ANY" for target in targets)


def _has_identity_restrictions(rule: Rule) -> bool:
    return (
        any(
            (
                rule.ip_ranges,
                rule.source_ip_ranges,
                rule.source_mac_addresses,
                rule.destination_mac_addresses,
                rule.source_network_id,
                rule.destination_network_id,
                rule.source_address_group_members,
                rule.destination_address_group_members,
                rule.destination_web_domains,
                rule.destination_app_ids,
            )
        )
        or _has_matching_target(rule)
    )


def _is_allow_all_service(rule: Rule) -> bool:
    return rule.protocol.lower() == "all" and not has_port_restrictions(rule)


def _is_return_traffic(rule: Rule) -> bool:
    """Detect established/related return traffic rules."""
    state_tokens = _tokenize(rule.connection_state_type)
    if state_tokens & _RETURN_TRAFFIC_STATES:
        return True
    return bool(_tokenize(rule.name) & _RETURN_TRAFFIC_KEYWORDS)


def _port_range_width(port_range: str) -> int:
    if "-" in port_range:
        parts = port_range.split("-", 1)
        try:
            return int(parts[1]) - int(parts[0]) + 1
        except (ValueError, IndexError):
            return 0
    return 1


def _check_allow_all_external(rule: Rule, src_name: str) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and _is_allow_all_service(rule)
        and not _has_identity_restrictions(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-external",
            severity="high",
            title="Unrestricted allow from external zone",
            description=f"Rule '{rule.name}' allows all traffic from {src_name} with no port or protocol restriction.",
            rationale=(
                f"This rule has no port, protocol, or IP restriction and the source zone '{src_name}' "
                "is internet-facing. Any service on the destination network is reachable."
            ),
            rule_id=rule.id,
        )
    return None


def _check_allow_all_protocols_ports(rule: Rule) -> Finding | None:
    """Flag an ALLOW rule that constrains neither service nor endpoint.

    A rule narrowed to specific hosts, MACs, networks, address groups, or
    domain/app matching criteria is a deliberate exception, not an
    unrestricted allow -- the same guard `_check_allow_all_external` applies.
    """
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_allow_all_service(rule)
        and not _has_identity_restrictions(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-protocols-ports",
            severity="high",
            title="Allow rule with no port or protocol restriction",
            description=f"Rule '{rule.name}' allows all protocols and ports.",
            rationale=(
                "This rule allows all protocols and ports without restriction. "
                "Traffic matching this rule is not constrained to specific services."
            ),
            rule_id=rule.id,
        )
    return None


def _check_allow_external_to_internal(
    rule: Rule, src_name: str, dst_name: str
) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and _is_internal(dst_name)
        and not _has_identity_restrictions(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-external-to-internal",
            severity="high",
            title="Allow from external to internal zone",
            description=f"Rule '{rule.name}' allows traffic from {src_name} to {dst_name} with no IP restriction.",
            rationale=(
                f"Traffic from '{src_name}' (internet-facing) can reach '{dst_name}' (internal) "
                "without IP-based access control. Any external host can initiate connections."
            ),
            rule_id=rule.id,
        )
    return None


def _check_disabled_block(rule: Rule) -> Finding | None:
    if not rule.enabled and rule.action in _BLOCK_ACTIONS:
        return Finding(
            id="disabled-block-rule",
            severity="medium",
            title="Disabled block rule",
            description=f"Rule '{rule.name}' blocks traffic but is disabled. Enable it or remove it.",
            rationale=(
                "A disabled block rule has no effect on traffic. If the block was intentional, "
                "leaving it disabled weakens the security posture."
            ),
            rule_id=rule.id,
        )
    return None


def _check_no_connection_state(rules: list[Rule]) -> list[Finding]:
    """Report stateless ALLOW rules once per zone pair, not once per rule.

    Reported per rule at high severity this drowned out everything else: it
    fires on every ALLOW rule that does not set a connection state, so a pair
    of five well-scoped rules scored 0/F on this finding alone, and a rule
    pinned to one host scored the same as a wide-open one. It is hardening
    advice ("consider restricting to new connections"), not a vulnerability,
    and the advice is identical for every rule -- so it is one low-severity
    finding listing the rules it applies to.
    """
    affected = [
        rule
        for rule in rules
        if rule.enabled
        and rule.action == "ALLOW"
        and not rule.predefined
        and not rule.connection_state_type
        and not _is_return_traffic(rule)
    ]
    if not affected:
        return []

    names = ", ".join(f"'{rule.name}'" for rule in affected)
    return [
        Finding(
            id="no-connection-state",
            severity="low",
            title="Allow rules without connection state tracking",
            description=(
                f"{len(affected)} allow rule{'s' if len(affected) > 1 else ''} "
                f"do not set connection state tracking: {names}."
            ),
            rationale=(
                "Without connection state tracking, these rules accept both new and established "
                "connections. Consider restricting to 'new' connections with separate "
                "established/related return rules for tighter control."
            ),
            rule_ids=[rule.id for rule in affected],
        )
    ]


_BROAD_ADDRESSES = {"0.0.0.0/0", "::/0", "any"}


def _check_broad_address_group(rule: Rule) -> Finding | None:
    if not rule.enabled or rule.action != "ALLOW":
        return None
    for group_name, members in [
        (rule.source_address_group, rule.source_address_group_members),
        (rule.destination_address_group, rule.destination_address_group_members),
    ]:
        if any(m.lower() in _BROAD_ADDRESSES for m in members):
            return Finding(
                id="broad-address-group",
                severity="medium",
                title="Address group contains unrestricted address",
                description=f"Rule '{rule.name}' uses address group '{group_name}' containing an unrestricted address.",
                rationale=(
                    f"Address group '{group_name}' contains a wildcard address (e.g. 0.0.0.0/0) "
                    "which matches all hosts. The group provides no actual restriction."
                ),
                rule_id=rule.id,
            )
    return None


def _check_missing_block_logging(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action in _BLOCK_ACTIONS and not rule.connection_logging:
        return Finding(
            id="missing-block-logging",
            severity="low",
            title="Block rule without logging",
            description=f"Block rule '{rule.name}' has logging disabled.",
            rationale=(
                "Block rules without logging make it difficult to detect and investigate "
                "denied traffic. Enabling logging provides an audit trail for troubleshooting "
                "and security review."
            ),
            rule_id=rule.id,
        )
    return None


def _check_schedule_dependent_allow(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action == "ALLOW" and rule.schedule:
        return Finding(
            id="schedule-dependent-allow",
            severity="low",
            title="Schedule-dependent allow rule",
            description=f"Rule '{rule.name}' allows traffic only during schedule '{rule.schedule}'.",
            rationale=(
                "Schedule-dependent rules create time windows where access policy changes. "
                "Security posture varies by time of day, which should be explicitly acknowledged."
            ),
            rule_id=rule.id,
        )
    return None


def _check_wide_port_range(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action == "ALLOW":
        for pr in destination_port_constraints(rule):
            if _port_range_width(pr) >= 1000:
                return Finding(
                    id="wide-port-range",
                    severity="medium",
                    title="Allow rule with wide port range",
                    description=f"Rule '{rule.name}' allows a wide port range ({pr}).",
                    rationale=(
                        f"A port range of {_port_range_width(pr)} ports exposes a large attack surface. "
                        "Consider restricting to the specific ports required."
                    ),
                    rule_id=rule.id,
                )
    return None


def _check_predefined_rules(rules: list[Rule]) -> list[Finding]:
    predefined_rules = [rule for rule in rules if rule.predefined]
    if not predefined_rules:
        return []

    if len(predefined_rules) == 1:
        rule = predefined_rules[0]
        return [
            Finding(
                id="predefined-unreviewed",
                severity="low",
                title="Predefined UniFi rule present",
                description=f"UniFi predefined rule '{rule.name}' affects this zone pair. Review built-in behavior.",
                rationale=(
                    "Predefined rules are managed by UniFi and may change with firmware updates. "
                    "Review their behavior periodically."
                ),
                rule_id=rule.id,
            )
        ]

    return [
        Finding(
            id="predefined-unreviewed",
            severity="low",
            title="Predefined UniFi rules present",
            description=(
                f"{len(predefined_rules)} UniFi predefined rules affect this zone pair. "
                "Review built-in behavior."
            ),
            rationale=(
                "Predefined rules are managed by UniFi and may change with firmware updates. "
                "Review their behavior periodically."
            ),
        )
    ]


def _shadow_finding(earlier: Rule, later: Rule) -> Finding:
    """Grade a shadow by its consequence, not just its mechanism.

    "Will never match" means three different things depending on which action
    swallows which: a dead BLOCK silently admits traffic the operator believes
    is blocked (a security gap), a dead ALLOW breaks whatever depended on it
    (an outage, but a loud one), and a same-action duplicate merely clutters.
    """
    earlier_blocks = earlier.action in _BLOCK_ACTIONS
    later_blocks = later.action in _BLOCK_ACTIONS
    if later_blocks and not earlier_blocks:
        severity = "high"
        title = "Block rule never takes effect"
        consequence = (
            f"Traffic it is meant to block is accepted by '{earlier.name}' first, "
            "so this block protects nothing."
        )
    elif earlier_blocks and not later_blocks:
        severity = "medium"
        title = "Allow rule never takes effect"
        consequence = (
            f"Traffic it is meant to admit is dropped by '{earlier.name}' first, "
            "so whatever depends on this allow is unreachable through this zone pair."
        )
    else:
        severity = "low"
        title = "Redundant rule"
        consequence = f"It duplicates the effect of '{earlier.name}' and can be removed."
    return Finding(
        id="shadowed-rule",
        severity=severity,
        title=title,
        description=(
            f"Rule '{later.name}' is shadowed by earlier rule '{earlier.name}' "
            f"({earlier.action}) and will never match. {consequence}"
        ),
        rationale=(
            f"Across every criterion this analysis models (protocol, ports, IPs, MACs, "
            f"address groups, networks, connection state, schedule, IPSec, and domain/app "
            f"matching), '{earlier.name}' at index {earlier.index} matches all traffic "
            f"that '{later.name}' at index {later.index} would match, and it runs first. "
            f"Move '{later.name}' above '{earlier.name}' or remove it."
        ),
        rule_id=later.id,
    )


def _check_shadowed(rules: list[Rule]) -> list[Finding]:
    findings: list[Finding] = []
    enabled_rules = [r for r in rules if r.enabled]
    sorted_rules = sorted(enabled_rules, key=lambda r: r.index)

    for i, later in enumerate(sorted_rules):
        if later.predefined:
            continue
        for earlier in sorted_rules[:i]:
            if rule_shadows(earlier, later):
                findings.append(_shadow_finding(earlier, later))
                break
    return findings


def _overlap_finding(earlier: Rule, later: Rule) -> Finding:
    """Grade an overlap by its shape.

    When the later, broader rule covers everything the earlier rule matches,
    the earlier rule is a specific exception sitting above a general rule --
    the standard way to express precedence (allow these domains, block the
    rest; block SSH, allow the other ports). Nothing is dead or ambiguous, so
    that shape is a low-severity awareness note. A criss-cross overlap, where
    neither rule contains the other, keeps medium: the overlap region wins or
    loses on ordering alone, which is easy to get wrong by accident.
    """
    if rule_shadows(later, earlier):
        return Finding(
            id="overlapping-allow-block",
            severity="low",
            title="Exception rule ahead of a broader rule",
            description=(
                f"Rule '{earlier.name}' ({earlier.action}) carves an exception out of the "
                f"broader '{later.name}' ({later.action}): it matches a subset of the same "
                f"traffic and runs first."
            ),
            rationale=(
                f"A specific rule ordered above a general one with the opposite action is the "
                f"standard way to express precedence -- '{later.name}' still handles all "
                f"traffic outside the exception. Flagged for awareness only: confirm the "
                f"exception is intended."
            ),
            rule_id=later.id,
        )
    return Finding(
        id="overlapping-allow-block",
        severity="medium",
        title="Overlapping allow/block rules",
        description=(
            f"Rule '{later.name}' ({later.action}) partially overlaps with "
            f"earlier rule '{earlier.name}' ({earlier.action})."
        ),
        rationale=(
            f"These rules have different actions and overlapping port ranges, and neither "
            f"fully contains the other. For the overlapping traffic the earlier rule "
            f"({earlier.action}) wins on ordering alone. Review whether the intended "
            f"behavior requires this ordering."
        ),
        rule_id=later.id,
    )


def _check_overlapping(rules: list[Rule]) -> list[Finding]:
    """Flag rules with different actions but overlapping port ranges (not full shadows)."""
    findings: list[Finding] = []
    enabled_rules = [r for r in rules if r.enabled and not r.predefined]
    sorted_rules = sorted(enabled_rules, key=lambda r: r.index)
    for i, later in enumerate(sorted_rules):
        for earlier in sorted_rules[:i]:
            if earlier.action == later.action:
                continue
            if not protocol_covers(earlier, later):
                continue
            if rule_shadows(earlier, later):
                continue
            earlier_dst = destination_port_constraints(earlier)
            later_dst = destination_port_constraints(later)
            if port_ranges_overlap(earlier_dst, later_dst):
                findings.append(_overlap_finding(earlier, later))
                break
    return findings


def analyze_zone_pair(
    rules: list[Rule], src_zone_name: str, dst_zone_name: str
) -> AnalysisResult:
    """Analyze a zone pair's rules and return findings with a score."""
    findings: list[Finding] = []

    if not rules:
        findings.append(
            Finding(
                id="no-explicit-rules",
                severity="low",
                title="No explicit rules",
                description="This zone pair has no explicit firewall rules.",
                rationale=(
                    "Without explicit rules, traffic between these zones relies entirely "
                    "on the default policy."
                ),
            )
        )
    else:
        findings.extend(_check_predefined_rules(rules))
        for rule in rules:
            if rule.predefined:
                continue
            broad_allow_finding = _check_allow_external_to_internal(rule, src_zone_name, dst_zone_name)
            if broad_allow_finding is None:
                broad_allow_finding = _check_allow_all_external(rule, src_zone_name)
            if broad_allow_finding is None:
                broad_allow_finding = _check_allow_all_protocols_ports(rule)
            if broad_allow_finding is not None:
                findings.append(broad_allow_finding)

            for check in (
                _check_disabled_block,
                _check_wide_port_range,
                _check_broad_address_group,
                _check_missing_block_logging,
                _check_schedule_dependent_allow,
            ):
                finding = check(rule)
                if finding is not None:
                    findings.append(finding)

        findings.extend(_check_no_connection_state(rules))
        findings.extend(_check_shadowed(rules))
        findings.extend(_check_overlapping(rules))

    score = 100
    for f in findings:
        score -= DEDUCTIONS.get(f.severity, 0)
    score = max(score, 0)

    return AnalysisResult(score=score, grade=compute_grade(score), findings=findings)
