from unittest.mock import patch

import pytest
from httpx import AsyncClient
from unifi_topology.adapters.unifi_api import UnifiAuthError


def _mock_login_validation():
    """Patch the controller validation call to succeed."""
    return patch("app.routers.auth.fetch_firewall_zones")


@pytest.mark.anyio
async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_status_no_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["configured"] is False
    assert data["source"] == "none"
    assert data["url"] == ""
    assert data["username"] == ""
    assert data["auth_method"] == "none"


@pytest.mark.anyio
async def test_login_stores_credentials(client: AsyncClient) -> None:
    with _mock_login_validation():
        resp = await client.post(
            "/api/auth/login",
            json={
                "url": "https://unifi.example.com",
                "username": "admin",
                "password": "secret",
                "site": "default",
                "verify_ssl": False,
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["message"] == "Credentials verified"

    # Status should now show runtime credentials
    status_resp = await client.get("/api/auth/status")
    status_data = status_resp.json()
    assert status_data["configured"] is True
    assert status_data["source"] == "runtime"
    assert status_data["url"] == "https://unifi.example.com"
    assert status_data["username"] == "admin"
    assert status_data["auth_method"] == "password"


@pytest.mark.anyio
async def test_login_invalid_credentials_returns_401(client: AsyncClient) -> None:
    with patch("app.routers.auth.fetch_firewall_zones", side_effect=UnifiAuthError("Invalid credentials")):
        resp = await client.post(
            "/api/auth/login",
            json={"url": "https://unifi.example.com", "username": "admin", "password": "wrong"},
        )
    assert resp.status_code == 401
    assert "Invalid controller credentials" in resp.json()["detail"]

    # Credentials should NOT be stored
    status_resp = await client.get("/api/auth/status")
    assert status_resp.json()["configured"] is False


@pytest.mark.anyio
async def test_login_unreachable_controller_returns_502(client: AsyncClient) -> None:
    with patch("app.routers.auth.fetch_firewall_zones", side_effect=ConnectionError("refused")):
        resp = await client.post(
            "/api/auth/login",
            json={"url": "https://unreachable.local", "username": "admin", "password": "pass"},
        )
    assert resp.status_code == 502
    assert "Could not reach controller" in resp.json()["detail"]

    status_resp = await client.get("/api/auth/status")
    assert status_resp.json()["configured"] is False


@pytest.mark.anyio
async def test_logout_clears_credentials(client: AsyncClient) -> None:
    # First login
    with _mock_login_validation():
        await client.post(
            "/api/auth/login",
            json={"url": "https://unifi.example.com", "username": "admin", "password": "secret"},
        )

    # Then logout
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"

    # Status should show no credentials
    status_resp = await client.get("/api/auth/status")
    status_data = status_resp.json()
    assert status_data["configured"] is False
    assert status_data["source"] == "none"


@pytest.mark.anyio
async def test_login_with_defaults(client: AsyncClient) -> None:
    """Login with only required fields uses sensible defaults."""
    with _mock_login_validation():
        resp = await client.post(
            "/api/auth/login",
            json={"url": "https://unifi.local", "username": "admin", "password": "pass"},
        )
    assert resp.status_code == 200

    from app.config import get_unifi_config

    config = get_unifi_config()
    assert config is not None
    assert config.site == "default"
    assert config.verify_ssl is False


@pytest.mark.anyio
async def test_login_replaces_previous_credentials(client: AsyncClient) -> None:
    """A second login replaces the first set of credentials."""
    with _mock_login_validation():
        await client.post(
            "/api/auth/login",
            json={"url": "https://first.example.com", "username": "u1", "password": "p1"},
        )
        await client.post(
            "/api/auth/login",
            json={"url": "https://second.example.com", "username": "u2", "password": "p2"},
        )

    status_resp = await client.get("/api/auth/status")
    data = status_resp.json()
    assert data["url"] == "https://second.example.com"


@pytest.mark.anyio
async def test_login_with_api_key_stores_credentials(client: AsyncClient) -> None:
    """Login with an API key stores api-key credentials and reports the method."""
    with _mock_login_validation():
        resp = await client.post(
            "/api/auth/login",
            json={"url": "https://unifi.example.com", "api_key": "secret-key", "site": "default"},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    status_resp = await client.get("/api/auth/status")
    status_data = status_resp.json()
    assert status_data["configured"] is True
    assert status_data["source"] == "runtime"
    assert status_data["url"] == "https://unifi.example.com"
    assert status_data["username"] == ""
    assert status_data["auth_method"] == "api_key"


@pytest.mark.anyio
async def test_login_api_key_invalid_returns_401(client: AsyncClient) -> None:
    with patch("app.routers.auth.fetch_firewall_zones", side_effect=UnifiAuthError("bad key")):
        resp = await client.post(
            "/api/auth/login",
            json={"url": "https://unifi.example.com", "api_key": "wrong-key"},
        )
    assert resp.status_code == 401
    status_resp = await client.get("/api/auth/status")
    assert status_resp.json()["configured"] is False


@pytest.mark.anyio
async def test_login_validation_missing_fields(client: AsyncClient) -> None:
    """No auth method provided should return 422."""
    resp = await client.post(
        "/api/auth/login",
        json={"url": "https://unifi.local"},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_login_rejects_both_auth_methods(client: AsyncClient) -> None:
    """Providing both api_key and username/password should return 422."""
    resp = await client.post(
        "/api/auth/login",
        json={
            "url": "https://unifi.local",
            "username": "admin",
            "password": "pass",
            "api_key": "key",
        },
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_app_logout_clears_cookie(client: AsyncClient) -> None:
    """app-logout should return ok and delete the session cookie."""
    resp = await client.post("/api/auth/app-logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
