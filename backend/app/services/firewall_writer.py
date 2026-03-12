"""Write operations for UniFi firewall policies.

Thin HTTP wrapper that bypasses the read-only unifi-topology library
for mutation operations (toggle, reorder).  Assumes UDM Pro (UniFi OS)
since zone-based policies are only available on that platform.
"""

from __future__ import annotations

import requests

from app.config import UnifiCredentials


class WriteError(Exception):
    """A write operation to the UniFi controller failed."""


def _build_api_base(url: str) -> str:
    """Build the API base URL for UDM Pro."""
    return f"{url.rstrip('/')}/proxy/network"


def _get_session(credentials: UnifiCredentials) -> requests.Session:
    """Create an authenticated requests.Session."""
    if not credentials.verify_ssl:
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()
    login_url = f"{credentials.url.rstrip('/')}/api/auth/login"
    try:
        resp = session.post(
            login_url,
            json={"username": credentials.username, "password": credentials.password},
            verify=credentials.verify_ssl,
        )
    except requests.RequestException as exc:
        raise WriteError(f"Authentication failed: {exc}") from exc
    if not resp.ok:
        raise WriteError(f"Authentication failed (HTTP {resp.status_code})")
    return session


def _get_v2(
    session: requests.Session,
    url: str,
    path: str,
    *,
    verify_ssl: bool,
) -> dict[str, object]:
    """GET a single resource from a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.get(full_url, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        raise WriteError(f"GET {path} failed (HTTP {response.status_code})")
    payload = response.json()
    if isinstance(payload, list):
        if len(payload) != 1:
            raise WriteError(f"Expected single policy, got {len(payload)}")
        return payload[0]  # type: ignore[no-any-return]
    return payload  # type: ignore[no-any-return]


def _get_v2_list(
    session: requests.Session,
    url: str,
    path: str,
    *,
    verify_ssl: bool,
) -> list[dict[str, object]]:
    """GET a list of resources from a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.get(full_url, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        raise WriteError(f"GET {path} failed (HTTP {response.status_code})")
    payload = response.json()
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]  # type: ignore[no-any-return]
    raise WriteError(f"Unexpected response format for {path}")


def _put_v2(
    session: requests.Session,
    url: str,
    path: str,
    payload: dict[str, object],
    *,
    verify_ssl: bool,
) -> None:
    """PUT to a V2 API endpoint."""
    full_url = f"{_build_api_base(url)}{path}"
    response = session.put(full_url, json=payload, verify=verify_ssl)
    if response.status_code == 401:
        raise WriteError("Session expired")
    if not response.ok:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise WriteError(f"PUT {path} failed (HTTP {response.status_code}): {detail}")


def toggle_policy(
    credentials: UnifiCredentials,
    policy_id: str,
    *,
    enabled: bool,
) -> None:
    """Toggle a firewall policy's enabled state."""
    session = _get_session(credentials)
    path = f"/v2/api/site/{credentials.site}/firewall-policies/{policy_id}"
    policy = _get_v2(session, credentials.url, path, verify_ssl=credentials.verify_ssl)
    policy["enabled"] = enabled
    _put_v2(session, credentials.url, path, policy, verify_ssl=credentials.verify_ssl)


def swap_policy_order(
    credentials: UnifiCredentials,
    policy_id_a: str,
    policy_id_b: str,
) -> None:
    """Swap the index (priority) of two firewall policies."""
    session = _get_session(credentials)
    base_path = f"/v2/api/site/{credentials.site}/firewall-policies"
    all_policies = _get_v2_list(session, credentials.url, base_path, verify_ssl=credentials.verify_ssl)

    policy_a = next((p for p in all_policies if p.get("_id") == policy_id_a), None)
    policy_b = next((p for p in all_policies if p.get("_id") == policy_id_b), None)

    if not policy_a or not policy_b:
        missing = [pid for pid, p in [(policy_id_a, policy_a), (policy_id_b, policy_b)] if not p]
        raise WriteError(f"Policy not found: {', '.join(missing)}")

    idx_a = policy_a["index"]
    idx_b = policy_b["index"]
    policy_a["index"] = idx_b
    policy_b["index"] = idx_a

    _put_v2(session, credentials.url, f"{base_path}/{policy_id_a}", policy_a, verify_ssl=credentials.verify_ssl)
    _put_v2(session, credentials.url, f"{base_path}/{policy_id_b}", policy_b, verify_ssl=credentials.verify_ssl)
