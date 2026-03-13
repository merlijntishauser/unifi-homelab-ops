"""Mock UniFi controller for production e2e tests.

Serves static JSON fixtures on the same endpoints that unifi-topology calls.
Supports both legacy (classic) and V2 API response formats.
"""

import json
from pathlib import Path

from fastapi import FastAPI, Response

app = FastAPI(title="Mock UniFi Controller")

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> list[dict]:
    return json.loads((FIXTURES / f"{name}.json").read_text())


@app.post("/api/login")
async def login(response: Response) -> dict:
    """Legacy controller login -- return ok with a session cookie."""
    response.set_cookie("unifises", "mock-session-token", httponly=True)
    return {"meta": {"rc": "ok"}, "data": []}


@app.get("/v2/api/site/{site}/firewall/zone")
async def firewall_zones(site: str) -> list[dict]:
    """V2 API: return zones as a plain list."""
    return _load("zones")


@app.get("/v2/api/site/{site}/firewall-policies")
async def firewall_policies(site: str) -> list[dict]:
    """V2 API: return policies as a plain list."""
    return _load("policies")


@app.get("/api/s/{site}/rest/firewallgroup")
async def firewall_groups(site: str) -> dict:
    """Classic API: return groups in {data: [...]} envelope."""
    return {"meta": {"rc": "ok"}, "data": _load("groups")}


@app.get("/api/s/{site}/rest/networkconf")
async def networks(site: str) -> dict:
    """Classic API: return networks in {data: [...]} envelope."""
    return {"meta": {"rc": "ok"}, "data": _load("networks")}


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
