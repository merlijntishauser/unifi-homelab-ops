"""Write operations for UniFi firewall policies.

Thin wrapper around unifi-topology write operations, converting
between analyser credentials and topology Config.
"""

from __future__ import annotations

import logging

from unifi_topology import UnifiWriteError
from unifi_topology import swap_firewall_policy_order as _swap_upstream
from unifi_topology import toggle_firewall_policy as _toggle_upstream

from app.config import UnifiCredentials
from app.services.firewall import to_topology_config

logger = logging.getLogger(__name__)

# Re-export for backward compatibility with router imports
WriteError = UnifiWriteError


def toggle_policy(
    credentials: UnifiCredentials,
    policy_id: str,
    *,
    enabled: bool,
) -> None:
    """Toggle a firewall policy's enabled state."""
    logger.debug("Toggle policy %s -> enabled=%s", policy_id, enabled)
    config = to_topology_config(credentials)
    _toggle_upstream(config, policy_id, enabled=enabled, site=credentials.site)
    logger.debug("Toggle policy %s succeeded", policy_id)


def swap_policy_order(
    credentials: UnifiCredentials,
    policy_id_a: str,
    policy_id_b: str,
) -> None:
    """Swap the index (priority) of two firewall policies."""
    logger.debug("Swap policy order: %s <-> %s", policy_id_a, policy_id_b)
    config = to_topology_config(credentials)
    _swap_upstream(config, policy_id_a, policy_id_b, site=credentials.site)
    logger.debug("Swap policy order succeeded")
