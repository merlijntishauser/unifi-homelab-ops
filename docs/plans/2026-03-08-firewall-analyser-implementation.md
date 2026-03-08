# UniFi Firewall Analyser -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web tool that visualizes UniFi zone-based firewall rules as an interactive node graph with packet simulation.

**Architecture:** FastAPI backend consuming `unifi-topology` for controller data, React + React Flow frontend for visualization. Docker Compose for local dev. The backend exposes REST endpoints for zones, rules, and packet simulation. The frontend renders zones as draggable nodes and rules as clickable edges with a side panel.

**Tech Stack:** Python 3.12+, FastAPI, uvicorn, pydantic, unifi-topology | React 18, @xyflow/react 12, Tailwind CSS 4, Vite | Docker Compose

**Key API endpoints (UniFi controller, local only):**
- Zones: `GET /proxy/network/integration/v1/sites/{site_id}/firewall/zones`
- Firewall policies: `GET /proxy/network/v2/api/site/{site}/firewall-policies`
- Firewall groups: `GET /proxy/network/api/s/{site}/rest/firewallgroup`
- Networks: `GET /proxy/network/api/s/{site}/rest/networkconf` (already in unifi-topology)

**Prerequisite:** PR to `unifi-topology` adding firewall zone/policy fetching (Task 1).

---

## Task 1: PR to unifi-topology -- Add Firewall Data Fetching

> This task is done in the **unifi-topology** repo (`/Users/merlijn/Development/personal/unifi-topology/`).
> Create a feature branch and PR when complete.

**Files:**
- Modify: `src/unifi_topology/adapters/unifi_api.py` -- add `_get_raw` and firewall endpoints
- Modify: `src/unifi_topology/adapters/unifi.py` -- add `fetch_firewall_zones`, `fetch_firewall_policies`, `fetch_firewall_groups`
- Create: `src/unifi_topology/model/firewall.py` -- firewall data models
- Modify: `src/unifi_topology/__init__.py` -- export new public API
- Create: `tests/unit/model/test_firewall.py` -- model tests
- Create: `tests/unit/adapters/test_firewall_fetch.py` -- fetch function tests

**Step 1: Write firewall data models**

Create `src/unifi_topology/model/firewall.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FirewallZone:
    id: str
    name: str
    network_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class FirewallPolicy:
    id: str
    name: str
    enabled: bool
    action: str  # "ALLOW", "BLOCK", "REJECT"
    source_zone_id: str
    destination_zone_id: str
    protocol: str = "all"
    port_ranges: tuple[str, ...] = ()
    ip_ranges: tuple[str, ...] = ()
    description: str = ""
    index: int = 0
    predefined: bool = False


@dataclass(frozen=True)
class FirewallGroup:
    id: str
    name: str
    group_type: str  # "address-group", "port-group", "ipv6-address-group"
    members: tuple[str, ...] = ()
```

**Step 2: Write tests for the models**

Create `tests/unit/model/test_firewall.py`:

```python
from unifi_topology.model.firewall import FirewallZone, FirewallPolicy, FirewallGroup


def test_firewall_zone_from_fields():
    zone = FirewallZone(
        id="abc123",
        name="IoT",
        network_ids=("net1", "net2"),
    )
    assert zone.name == "IoT"
    assert len(zone.network_ids) == 2


def test_firewall_policy_defaults():
    policy = FirewallPolicy(
        id="pol1",
        name="Block IoT to LAN",
        enabled=True,
        action="BLOCK",
        source_zone_id="zone_iot",
        destination_zone_id="zone_lan",
    )
    assert policy.protocol == "all"
    assert policy.port_ranges == ()
    assert policy.predefined is False


def test_firewall_group():
    group = FirewallGroup(
        id="grp1",
        name="DNS Servers",
        group_type="address-group",
        members=("1.1.1.1", "8.8.8.8"),
    )
    assert len(group.members) == 2
```

**Step 3: Run tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-topology && python -m pytest tests/unit/model/test_firewall.py -v`
Expected: PASS (3 tests)

**Step 4: Add `_get_raw` method to UnifiClient**

The existing `_get` extracts the `data` field from the classic API envelope. The integration API v1 and v2 API may use different response formats. Add a `_get_raw` method that returns the full parsed JSON.

Modify `src/unifi_topology/adapters/unifi_api.py` -- add method to `UnifiClient`:

```python
def _get_raw(self, path: str) -> dict[str, object] | list[dict[str, object]]:
    """GET request returning the full parsed JSON response (no envelope extraction)."""
    resp = self._session.get(f"{self._url}{path}", verify=self._verify_ssl)
    if resp.status_code == 401:
        self._authenticate()
        resp = self._session.get(f"{self._url}{path}", verify=self._verify_ssl)
    resp.raise_for_status()
    return resp.json()
```

**Step 5: Add firewall fetch methods to UnifiClient**

Modify `src/unifi_topology/adapters/unifi_api.py` -- add methods:

```python
def get_firewall_zones(self, site: str = "default") -> list[dict[str, object]]:
    return self._get_raw(f"/proxy/network/integration/v1/sites/{site}/firewall/zones")

def get_firewall_policies(self, site: str = "default") -> list[dict[str, object]]:
    return self._get_raw(f"/proxy/network/v2/api/site/{site}/firewall-policies")

def get_firewall_groups(self, site: str = "default") -> list[dict[str, object]]:
    return self._get(f"/api/s/{site}/rest/firewallgroup")
```

Note: The integration API and v2 API response formats need to be verified against a real controller. The `_get_raw` method gives flexibility to handle whatever format comes back. Adjust path prefixes based on actual controller responses (UDM vs non-UDM).

**Step 6: Add high-level fetch functions**

Modify `src/unifi_topology/adapters/unifi.py` -- add functions following the existing pattern (with caching, retries, etc.):

```python
from unifi_topology.model.firewall import FirewallZone, FirewallPolicy, FirewallGroup


def fetch_firewall_zones(
    config: Config,
    *,
    site: str | None = None,
    use_cache: bool = True,
) -> list[FirewallZone]:
    """Fetch firewall zone definitions from the controller."""
    # Follow the same pattern as fetch_devices/fetch_clients/fetch_networks
    # with caching, retries, and normalization
    ...


def fetch_firewall_policies(
    config: Config,
    *,
    site: str | None = None,
    use_cache: bool = True,
) -> list[FirewallPolicy]:
    """Fetch zone-based firewall policies."""
    ...


def fetch_firewall_groups(
    config: Config,
    *,
    site: str | None = None,
    use_cache: bool = True,
) -> list[FirewallGroup]:
    """Fetch firewall address/port groups."""
    ...
```

The normalization logic will need to map the raw API JSON fields to the dataclass fields. The exact field mapping depends on the real API response -- inspect responses from your controller to finalize. Key expected mappings:
- Zone: `_id` -> `id`, `name` -> `name`, `networkIds` -> `network_ids`
- Policy: `_id` -> `id`, `name` -> `name`, `enabled` -> `enabled`, `action` -> `action`, etc.
- Group: `_id` -> `id`, `name` -> `name`, `group_type` -> `group_type`, `group_members` -> `members`

**Step 7: Export new API from `__init__.py`**

Modify `src/unifi_topology/__init__.py` -- add exports:

```python
from unifi_topology.model.firewall import FirewallGroup, FirewallPolicy, FirewallZone
from unifi_topology.adapters.unifi import (
    fetch_firewall_groups,
    fetch_firewall_policies,
    fetch_firewall_zones,
)
```

**Step 8: Write integration-style tests with mocked API**

Create `tests/unit/adapters/test_firewall_fetch.py` -- test the normalization from raw API responses to dataclasses. Mock the UnifiClient to return sample JSON matching the real controller response format.

**Step 9: Run all tests**

Run: `cd /Users/merlijn/Development/personal/unifi-topology && python -m pytest -v`
Expected: All tests pass

**Step 10: Commit and create PR**

```bash
cd /Users/merlijn/Development/personal/unifi-topology
git checkout -b feat/firewall-zones-policies
git add src/unifi_topology/model/firewall.py src/unifi_topology/adapters/unifi_api.py src/unifi_topology/adapters/unifi.py src/unifi_topology/__init__.py tests/
git commit -m "feat: add firewall zone, policy, and group fetching"
```

---

## Task 2: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `frontend/Dockerfile`

**Step 1: Initialize git and create .gitignore**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git init
```

Create `.gitignore`:

```gitignore
# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
dist/

# IDE
.idea/
.vscode/

# Env
.env
.env.local

# OS
.DS_Store
```

**Step 2: Create backend requirements.txt**

Create `backend/requirements.txt`:

```
fastapi>=0.115,<1
uvicorn[standard]>=0.34,<1
pydantic>=2.0,<3
pydantic-settings>=2.0,<3
unifi-topology>=0.7
```

**Step 3: Create backend Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 4: Create frontend Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Step 5: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend/app:/app/app
    env_file:
      - .env
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/index.html:/app/index.html
    depends_on:
      - backend
```

**Step 6: Create .env.example**

Create `.env.example`:

```bash
UNIFI_URL=https://192.168.1.1
UNIFI_SITE=default
UNIFI_USER=admin
UNIFI_PASS=changeme
UNIFI_VERIFY_SSL=false
```

**Step 7: Commit**

```bash
git add .gitignore docker-compose.yml backend/Dockerfile backend/requirements.txt frontend/Dockerfile .env.example
git commit -m "chore: project scaffolding with Docker Compose"
```

---

## Task 3: Backend FastAPI Skeleton

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`

**Step 1: Create config module**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    unifi_url: str = ""
    unifi_site: str = "default"
    unifi_user: str = ""
    unifi_pass: str = ""
    unifi_verify_ssl: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
```

**Step 2: Create FastAPI app**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="UniFi Firewall Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

Create empty `__init__.py` files for `backend/app/`, `backend/app/routers/`, `backend/app/services/`.

**Step 3: Verify it runs**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser && docker compose up backend --build`
Expected: FastAPI starts on port 8000, `GET /api/health` returns `{"status": "ok"}`

**Step 4: Commit**

```bash
git add backend/app/
git commit -m "feat: FastAPI backend skeleton with health endpoint"
```

---

## Task 4: Backend Auth Router

**Files:**
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py` -- include router
- Modify: `backend/app/config.py` -- add runtime override support

**Step 1: Add runtime credential storage to config**

Modify `backend/app/config.py` -- add a mutable runtime override:

```python
from pydantic_settings import BaseSettings
from unifi_topology import Config as UnifiConfig


class Settings(BaseSettings):
    unifi_url: str = ""
    unifi_site: str = "default"
    unifi_user: str = ""
    unifi_pass: str = ""
    unifi_verify_ssl: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()

# Runtime override (set via login endpoint)
_runtime_override: dict[str, str] | None = None


def set_runtime_credentials(url: str, user: str, password: str, site: str, verify_ssl: bool) -> None:
    global _runtime_override
    _runtime_override = {
        "url": url,
        "user": user,
        "password": password,
        "site": site,
        "verify_ssl": str(verify_ssl).lower(),
    }


def clear_runtime_credentials() -> None:
    global _runtime_override
    _runtime_override = None


def get_unifi_config() -> UnifiConfig:
    if _runtime_override:
        return UnifiConfig(
            url=_runtime_override["url"],
            site=_runtime_override["site"],
            user=_runtime_override["user"],
            password=_runtime_override["password"],
            verify_ssl=_runtime_override["verify_ssl"] == "true",
        )
    return UnifiConfig(
        url=settings.unifi_url,
        site=settings.unifi_site,
        user=settings.unifi_user,
        password=settings.unifi_pass,
        verify_ssl=settings.unifi_verify_ssl,
    )


def has_credentials() -> bool:
    if _runtime_override:
        return bool(_runtime_override["url"] and _runtime_override["user"])
    return bool(settings.unifi_url and settings.unifi_user)
```

**Step 2: Create auth router**

Create `backend/app/routers/auth.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import (
    clear_runtime_credentials,
    has_credentials,
    set_runtime_credentials,
    settings,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    url: str
    username: str
    password: str
    site: str = "default"
    verify_ssl: bool = False


class AuthStatus(BaseModel):
    configured: bool
    source: str  # "env" | "runtime" | "none"
    url: str


@router.post("/login")
async def login(req: LoginRequest):
    set_runtime_credentials(
        url=req.url,
        user=req.username,
        password=req.password,
        site=req.site,
        verify_ssl=req.verify_ssl,
    )
    return {"status": "ok"}


@router.post("/logout")
async def logout():
    clear_runtime_credentials()
    return {"status": "ok"}


@router.get("/status", response_model=AuthStatus)
async def status():
    from app.config import _runtime_override

    if _runtime_override and _runtime_override["url"]:
        return AuthStatus(configured=True, source="runtime", url=_runtime_override["url"])
    if settings.unifi_url:
        return AuthStatus(configured=True, source="env", url=settings.unifi_url)
    return AuthStatus(configured=False, source="none", url="")
```

**Step 3: Include router in main app**

Modify `backend/app/main.py` -- add:

```python
from app.routers import auth

app.include_router(auth.router)
```

**Step 4: Test manually**

Run: `docker compose up backend --build`
Test: `POST /api/auth/login` with credentials, `GET /api/auth/status` returns configured=True

**Step 5: Commit**

```bash
git add backend/app/config.py backend/app/routers/auth.py backend/app/main.py
git commit -m "feat: auth router with env + runtime credential support"
```

---

## Task 5: Backend Firewall Data Service

> **Depends on:** Task 1 (unifi-topology PR merged or installed from branch)

**Files:**
- Create: `backend/app/services/firewall.py`
- Create: `backend/app/models.py` -- API response models

**Step 1: Create API response models**

Create `backend/app/models.py`:

```python
from pydantic import BaseModel


class Network(BaseModel):
    id: str
    name: str
    vlan_id: int | None = None
    subnet: str | None = None


class Zone(BaseModel):
    id: str
    name: str
    networks: list[Network] = []


class Rule(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool
    action: str  # "ALLOW", "BLOCK", "REJECT"
    source_zone_id: str
    destination_zone_id: str
    protocol: str = "all"
    port_ranges: list[str] = []
    ip_ranges: list[str] = []
    index: int = 0
    predefined: bool = False


class ZonePair(BaseModel):
    source_zone_id: str
    destination_zone_id: str
    rules: list[Rule]
    allow_count: int
    block_count: int
```

**Step 2: Create firewall service**

Create `backend/app/services/firewall.py`:

```python
from unifi_topology import (
    Config as UnifiConfig,
    fetch_firewall_groups,
    fetch_firewall_policies,
    fetch_firewall_zones,
    fetch_networks,
)

from app.models import Network, Rule, Zone, ZonePair


def get_zones(config: UnifiConfig) -> list[Zone]:
    """Fetch zones and enrich with network details."""
    raw_zones = fetch_firewall_zones(config)
    raw_networks = fetch_networks(config)

    # Build network lookup by ID
    network_map: dict[str, Network] = {}
    for net in raw_networks:
        network_map[net.id] = Network(
            id=net.id,
            name=net.name,
            vlan_id=getattr(net, "vlan_id", None),
            subnet=getattr(net, "subnet", None),
        )

    zones = []
    for z in raw_zones:
        networks = [network_map[nid] for nid in z.network_ids if nid in network_map]
        zones.append(Zone(id=z.id, name=z.name, networks=networks))

    return zones


def get_rules(config: UnifiConfig) -> list[Rule]:
    """Fetch all firewall policies as rules."""
    policies = fetch_firewall_policies(config)
    return [
        Rule(
            id=p.id,
            name=p.name,
            description=p.description,
            enabled=p.enabled,
            action=p.action,
            source_zone_id=p.source_zone_id,
            destination_zone_id=p.destination_zone_id,
            protocol=p.protocol,
            port_ranges=list(p.port_ranges),
            ip_ranges=list(p.ip_ranges),
            index=p.index,
            predefined=p.predefined,
        )
        for p in policies
    ]


def get_zone_pairs(config: UnifiConfig) -> list[ZonePair]:
    """Build aggregated zone pairs from rules."""
    rules = get_rules(config)

    pairs: dict[tuple[str, str], list[Rule]] = {}
    for rule in rules:
        key = (rule.source_zone_id, rule.destination_zone_id)
        pairs.setdefault(key, []).append(rule)

    return [
        ZonePair(
            source_zone_id=src,
            destination_zone_id=dst,
            rules=sorted(rule_list, key=lambda r: r.index),
            allow_count=sum(1 for r in rule_list if r.action == "ALLOW" and r.enabled),
            block_count=sum(1 for r in rule_list if r.action in ("BLOCK", "REJECT") and r.enabled),
        )
        for (src, dst), rule_list in pairs.items()
    ]
```

Note: The exact attribute names from `fetch_networks` return type (`NetworkConf` or similar in unifi-topology) need to be verified. Adjust `net.id`, `net.name`, `net.vlan_id`, `net.subnet` to match the actual model fields.

**Step 3: Commit**

```bash
git add backend/app/models.py backend/app/services/firewall.py
git commit -m "feat: firewall data service with zone/rule fetching"
```

---

## Task 6: Backend API Endpoints -- Zones & Rules

**Files:**
- Create: `backend/app/routers/zones.py`
- Create: `backend/app/routers/rules.py`
- Modify: `backend/app/main.py` -- include routers

**Step 1: Create zones router**

Create `backend/app/routers/zones.py`:

```python
from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import Zone
from app.services.firewall import get_zones

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zones", response_model=list[Zone])
async def list_zones():
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No controller credentials configured")
    config = get_unifi_config()
    return get_zones(config)
```

**Step 2: Create rules router**

Create `backend/app/routers/rules.py`:

```python
from fastapi import APIRouter, HTTPException, Query

from app.config import get_unifi_config, has_credentials
from app.models import Rule, ZonePair
from app.services.firewall import get_rules, get_zone_pairs

router = APIRouter(prefix="/api", tags=["rules"])


@router.get("/rules", response_model=list[Rule])
async def list_rules(
    source_zone: str | None = Query(None),
    destination_zone: str | None = Query(None),
):
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No controller credentials configured")
    config = get_unifi_config()
    rules = get_rules(config)

    if source_zone:
        rules = [r for r in rules if r.source_zone_id == source_zone]
    if destination_zone:
        rules = [r for r in rules if r.destination_zone_id == destination_zone]

    return rules


@router.get("/zone-pairs", response_model=list[ZonePair])
async def list_zone_pairs():
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No controller credentials configured")
    config = get_unifi_config()
    return get_zone_pairs(config)
```

**Step 3: Include routers in main app**

Modify `backend/app/main.py` -- add:

```python
from app.routers import auth, zones, rules

app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(rules.router)
```

**Step 4: Commit**

```bash
git add backend/app/routers/zones.py backend/app/routers/rules.py backend/app/main.py
git commit -m "feat: zones and rules API endpoints"
```

---

## Task 7: Backend Packet Simulation Engine

**Files:**
- Create: `backend/app/services/simulator.py`
- Create: `backend/app/routers/simulate.py`
- Modify: `backend/app/main.py` -- include router
- Create: `backend/tests/test_simulator.py`

**Step 1: Write simulator tests**

Create `backend/tests/__init__.py` (empty) and `backend/tests/test_simulator.py`:

```python
from app.models import Network, Rule, Zone
from app.services.simulator import resolve_zone, evaluate_rules, SimulationResult


def _make_zones() -> list[Zone]:
    return [
        Zone(
            id="z_lan",
            name="LAN",
            networks=[Network(id="n1", name="Default", subnet="192.168.1.0/24")],
        ),
        Zone(
            id="z_iot",
            name="IoT",
            networks=[Network(id="n2", name="IoT Network", subnet="10.0.50.0/24")],
        ),
        Zone(
            id="z_wan",
            name="WAN",
            networks=[],
        ),
    ]


def _make_rules() -> list[Rule]:
    return [
        Rule(
            id="r1",
            name="Allow LAN to WAN",
            enabled=True,
            action="ALLOW",
            source_zone_id="z_lan",
            destination_zone_id="z_wan",
            index=1,
        ),
        Rule(
            id="r2",
            name="Block IoT to LAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="z_iot",
            destination_zone_id="z_lan",
            index=1,
        ),
        Rule(
            id="r3",
            name="Allow IoT DNS",
            enabled=True,
            action="ALLOW",
            source_zone_id="z_iot",
            destination_zone_id="z_wan",
            protocol="udp",
            port_ranges=["53"],
            index=1,
        ),
        Rule(
            id="r4",
            name="Disabled rule",
            enabled=False,
            action="ALLOW",
            source_zone_id="z_iot",
            destination_zone_id="z_lan",
            index=0,
        ),
    ]


def test_resolve_zone_by_subnet():
    zones = _make_zones()
    assert resolve_zone("192.168.1.50", zones) == "z_lan"
    assert resolve_zone("10.0.50.10", zones) == "z_iot"


def test_resolve_zone_unknown_ip():
    zones = _make_zones()
    assert resolve_zone("8.8.8.8", zones) is None


def test_evaluate_rules_match():
    rules = _make_rules()
    result = evaluate_rules(
        rules=rules,
        source_zone_id="z_lan",
        destination_zone_id="z_wan",
        protocol="tcp",
        port=443,
    )
    assert result.verdict == "ALLOW"
    assert result.matched_rule_id == "r1"


def test_evaluate_rules_block():
    rules = _make_rules()
    result = evaluate_rules(
        rules=rules,
        source_zone_id="z_iot",
        destination_zone_id="z_lan",
        protocol="tcp",
        port=80,
    )
    assert result.verdict == "BLOCK"
    assert result.matched_rule_id == "r2"


def test_evaluate_rules_protocol_port_match():
    rules = _make_rules()
    result = evaluate_rules(
        rules=rules,
        source_zone_id="z_iot",
        destination_zone_id="z_wan",
        protocol="udp",
        port=53,
    )
    assert result.verdict == "ALLOW"
    assert result.matched_rule_id == "r3"


def test_evaluate_rules_disabled_skipped():
    rules = _make_rules()
    result = evaluate_rules(
        rules=rules,
        source_zone_id="z_iot",
        destination_zone_id="z_lan",
        protocol="tcp",
        port=80,
    )
    # r4 is disabled (index=0, would be first), so r2 (BLOCK) should match
    assert result.verdict == "BLOCK"
    # Disabled rule should appear in evaluation chain
    skipped = [e for e in result.evaluations if e.rule_id == "r4"]
    assert len(skipped) == 1
    assert skipped[0].skipped_disabled is True


def test_evaluate_rules_no_match():
    rules = _make_rules()
    result = evaluate_rules(
        rules=rules,
        source_zone_id="z_lan",
        destination_zone_id="z_iot",
        protocol="tcp",
        port=80,
    )
    assert result.verdict is None
    assert result.matched_rule_id is None
    assert result.default_policy_used is True
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser && python -m pytest backend/tests/test_simulator.py -v`
Expected: FAIL (module not found)

**Step 3: Implement the simulator**

Create `backend/app/services/simulator.py`:

```python
from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field

from app.models import Rule, Zone


@dataclass
class RuleEvaluation:
    rule_id: str
    rule_name: str
    matched: bool
    reason: str
    skipped_disabled: bool = False


@dataclass
class SimulationResult:
    source_zone_id: str | None
    source_zone_name: str | None
    destination_zone_id: str | None
    destination_zone_name: str | None
    verdict: str | None  # "ALLOW", "BLOCK", "REJECT", or None
    matched_rule_id: str | None
    matched_rule_name: str | None
    default_policy_used: bool
    evaluations: list[RuleEvaluation] = field(default_factory=list)


def resolve_zone(ip: str, zones: list[Zone]) -> str | None:
    """Determine which zone an IP belongs to by matching against zone network subnets."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None

    for zone in zones:
        for network in zone.networks:
            if network.subnet:
                try:
                    net = ipaddress.ip_network(network.subnet, strict=False)
                    if addr in net:
                        return zone.id
                except ValueError:
                    continue
    return None


def _matches_protocol(rule: Rule, protocol: str) -> bool:
    return rule.protocol == "all" or rule.protocol == protocol


def _matches_port(rule: Rule, port: int | None) -> bool:
    if not rule.port_ranges:
        return True  # No port restriction = match all
    if port is None:
        return False
    for pr in rule.port_ranges:
        if "-" in pr:
            low, high = pr.split("-", 1)
            if int(low) <= port <= int(high):
                return True
        elif port == int(pr):
            return True
    return False


def evaluate_rules(
    rules: list[Rule],
    source_zone_id: str,
    destination_zone_id: str,
    protocol: str = "all",
    port: int | None = None,
) -> SimulationResult:
    """Evaluate rules for a zone pair and return the verdict."""
    # Filter to relevant zone pair and sort by index
    relevant = [
        r for r in rules
        if r.source_zone_id == source_zone_id and r.destination_zone_id == destination_zone_id
    ]
    relevant.sort(key=lambda r: r.index)

    evaluations: list[RuleEvaluation] = []
    matched_rule: Rule | None = None

    for rule in relevant:
        if not rule.enabled:
            evaluations.append(RuleEvaluation(
                rule_id=rule.id,
                rule_name=rule.name,
                matched=False,
                reason="disabled",
                skipped_disabled=True,
            ))
            continue

        if not _matches_protocol(rule, protocol):
            evaluations.append(RuleEvaluation(
                rule_id=rule.id,
                rule_name=rule.name,
                matched=False,
                reason=f"protocol mismatch (rule={rule.protocol}, packet={protocol})",
            ))
            continue

        if not _matches_port(rule, port):
            evaluations.append(RuleEvaluation(
                rule_id=rule.id,
                rule_name=rule.name,
                matched=False,
                reason=f"port mismatch (rule={rule.port_ranges}, packet={port})",
            ))
            continue

        evaluations.append(RuleEvaluation(
            rule_id=rule.id,
            rule_name=rule.name,
            matched=True,
            reason="first match",
        ))
        matched_rule = rule
        break

    return SimulationResult(
        source_zone_id=source_zone_id,
        source_zone_name=None,  # Filled by caller
        destination_zone_id=destination_zone_id,
        destination_zone_name=None,
        verdict=matched_rule.action if matched_rule else None,
        matched_rule_id=matched_rule.id if matched_rule else None,
        matched_rule_name=matched_rule.name if matched_rule else None,
        default_policy_used=matched_rule is None,
        evaluations=evaluations,
    )
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/merlijn/Development/personal/unifi-firewall-analyser && PYTHONPATH=backend python -m pytest backend/tests/test_simulator.py -v`
Expected: PASS (all 7 tests)

**Step 5: Create simulate router**

Create `backend/app/routers/simulate.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_unifi_config, has_credentials
from app.services.firewall import get_rules, get_zones
from app.services.simulator import (
    RuleEvaluation,
    SimulationResult,
    evaluate_rules,
    resolve_zone,
)

router = APIRouter(prefix="/api", tags=["simulate"])


class SimulateRequest(BaseModel):
    src_ip: str
    dst_ip: str
    protocol: str = "tcp"
    port: int | None = None


class SimulateResponse(BaseModel):
    source_zone_id: str | None
    source_zone_name: str | None
    destination_zone_id: str | None
    destination_zone_name: str | None
    verdict: str | None
    matched_rule_id: str | None
    matched_rule_name: str | None
    default_policy_used: bool
    evaluations: list[dict]


@router.post("/simulate", response_model=SimulateResponse)
async def simulate(req: SimulateRequest):
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No controller credentials configured")

    config = get_unifi_config()
    zones = get_zones(config)
    rules = get_rules(config)

    zone_map = {z.id: z.name for z in zones}

    src_zone = resolve_zone(req.src_ip, zones)
    dst_zone = resolve_zone(req.dst_ip, zones)

    if src_zone is None:
        raise HTTPException(status_code=400, detail=f"Could not resolve source IP {req.src_ip} to any zone")
    if dst_zone is None:
        raise HTTPException(status_code=400, detail=f"Could not resolve destination IP {req.dst_ip} to any zone")

    result = evaluate_rules(
        rules=rules,
        source_zone_id=src_zone,
        destination_zone_id=dst_zone,
        protocol=req.protocol,
        port=req.port,
    )
    result.source_zone_name = zone_map.get(src_zone)
    result.destination_zone_name = zone_map.get(dst_zone)

    return SimulateResponse(
        source_zone_id=result.source_zone_id,
        source_zone_name=result.source_zone_name,
        destination_zone_id=result.destination_zone_id,
        destination_zone_name=result.destination_zone_name,
        verdict=result.verdict,
        matched_rule_id=result.matched_rule_id,
        matched_rule_name=result.matched_rule_name,
        default_policy_used=result.default_policy_used,
        evaluations=[
            {
                "rule_id": e.rule_id,
                "rule_name": e.rule_name,
                "matched": e.matched,
                "reason": e.reason,
                "skipped_disabled": e.skipped_disabled,
            }
            for e in result.evaluations
        ],
    )
```

**Step 6: Include simulate router in main app**

Modify `backend/app/main.py` -- add:

```python
from app.routers import auth, zones, rules, simulate

app.include_router(simulate.router)
```

**Step 7: Commit**

```bash
git add backend/app/services/simulator.py backend/app/routers/simulate.py backend/tests/ backend/app/main.py
git commit -m "feat: packet simulation engine with zone resolution and rule evaluation"
```

---

## Task 8: Frontend Scaffold -- Vite + React + Tailwind

**Files:**
- Create: `frontend/` via `npm create vite@latest`
- Install: `@xyflow/react`, `@dagrejs/dagre`, Tailwind CSS 4

**Step 1: Create Vite React TypeScript project**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Install dependencies**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser/frontend
npm install @xyflow/react @dagrejs/dagre
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tailwind with Vite**

Modify `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

Replace contents of `frontend/src/index.css`:

```css
@import "tailwindcss";
@import "@xyflow/react/dist/style.css";
```

**Step 4: Clean up default Vite boilerplate**

Remove `frontend/src/App.css`. Replace `frontend/src/App.tsx`:

```tsx
function App() {
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="p-4 text-xl font-semibold">UniFi Firewall Analyser</h1>
    </div>
  );
}

export default App;
```

**Step 5: Verify it runs**

Run: `cd frontend && npm run dev`
Expected: App renders at localhost:5173 with the title

**Step 6: Commit**

```bash
cd /Users/merlijn/Development/personal/unifi-firewall-analyser
git add frontend/
git commit -m "feat: frontend scaffold with React, Tailwind CSS, React Flow"
```

---

## Task 9: Frontend API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/types.ts`

**Step 1: Create shared types**

Create `frontend/src/api/types.ts`:

```typescript
export interface Network {
  id: string;
  name: string;
  vlan_id: number | null;
  subnet: string | null;
}

export interface Zone {
  id: string;
  name: string;
  networks: Network[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: "ALLOW" | "BLOCK" | "REJECT";
  source_zone_id: string;
  destination_zone_id: string;
  protocol: string;
  port_ranges: string[];
  ip_ranges: string[];
  index: number;
  predefined: boolean;
}

export interface ZonePair {
  source_zone_id: string;
  destination_zone_id: string;
  rules: Rule[];
  allow_count: number;
  block_count: number;
}

export interface SimulateRequest {
  src_ip: string;
  dst_ip: string;
  protocol: string;
  port: number | null;
}

export interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  matched: boolean;
  reason: string;
  skipped_disabled: boolean;
}

export interface SimulateResponse {
  source_zone_id: string | null;
  source_zone_name: string | null;
  destination_zone_id: string | null;
  destination_zone_name: string | null;
  verdict: string | null;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  default_policy_used: boolean;
  evaluations: RuleEvaluation[];
}

export interface AuthStatus {
  configured: boolean;
  source: "env" | "runtime" | "none";
  url: string;
}
```

**Step 2: Create API client**

Create `frontend/src/api/client.ts`:

```typescript
import type {
  AuthStatus,
  Rule,
  SimulateRequest,
  SimulateResponse,
  Zone,
  ZonePair,
} from "./types";

const BASE = "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getAuthStatus: () => fetchJson<AuthStatus>("/auth/status"),

  login: (url: string, username: string, password: string, site: string, verifySsl: boolean) =>
    fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ url, username, password, site, verify_ssl: verifySsl }),
    }),

  logout: () => fetchJson("/auth/logout", { method: "POST" }),

  getZones: () => fetchJson<Zone[]>("/zones"),

  getRules: () => fetchJson<Rule[]>("/rules"),

  getZonePairs: () => fetchJson<ZonePair[]>("/zone-pairs"),

  simulate: (req: SimulateRequest) =>
    fetchJson<SimulateResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
```

**Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: API client with TypeScript types"
```

---

## Task 10: Frontend Login Screen

**Files:**
- Create: `frontend/src/components/LoginScreen.tsx`
- Modify: `frontend/src/App.tsx` -- conditional rendering

**Step 1: Create LoginScreen component**

Create `frontend/src/components/LoginScreen.tsx`:

```tsx
import { useState } from "react";
import { api } from "../api/client";

interface Props {
  onLoggedIn: () => void;
  defaultUrl?: string;
}

export function LoginScreen({ onLoggedIn, defaultUrl = "" }: Props) {
  const [url, setUrl] = useState(defaultUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [site, setSite] = useState("default");
  const [verifySsl, setVerifySsl] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(url, username, password, site, verifySsl);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-gray-800"
      >
        <h2 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
          Connect to UniFi Controller
        </h2>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <label className="mb-4 block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Controller URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://192.168.1.1"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>

        <label className="mb-4 block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>

        <label className="mb-4 block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>

        <label className="mb-4 block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Site</span>
          <input
            type="text"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>

        <label className="mb-6 flex items-center gap-2">
          <input
            type="checkbox"
            checked={verifySsl}
            onChange={(e) => setVerifySsl(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Verify SSL certificate</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Update App.tsx with auth flow**

Replace `frontend/src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "./api/client";
import { LoginScreen } from "./components/LoginScreen";

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.getAuthStatus().then((s) => setAuthed(s.configured));
  }, []);

  if (authed === null) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="p-4 text-xl font-semibold">UniFi Firewall Analyser</h1>
      <p className="px-4">Connected. Zone graph will render here.</p>
    </div>
  );
}

export default App;
```

**Step 3: Commit**

```bash
git add frontend/src/components/LoginScreen.tsx frontend/src/App.tsx
git commit -m "feat: login screen with controller credential form"
```

---

## Task 11: Frontend Zone Graph

**Files:**
- Create: `frontend/src/components/ZoneNode.tsx`
- Create: `frontend/src/components/RuleEdge.tsx`
- Create: `frontend/src/components/ZoneGraph.tsx`
- Create: `frontend/src/hooks/useFirewallData.ts`
- Create: `frontend/src/utils/layout.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Create data fetching hook**

Create `frontend/src/hooks/useFirewallData.ts`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Zone, ZonePair } from "../api/types";

export function useFirewallData() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonePairs, setZonePairs] = useState<ZonePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, zp] = await Promise.all([api.getZones(), api.getZonePairs()]);
      setZones(z);
      setZonePairs(zp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { zones, zonePairs, loading, error, refresh };
}
```

**Step 2: Create layout utility**

Create `frontend/src/utils/layout.ts`:

```typescript
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

export function getLayoutedElements(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 120, nodesep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

**Step 3: Create custom ZoneNode**

Create `frontend/src/components/ZoneNode.tsx`:

```tsx
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type ZoneNodeData = {
  label: string;
  networkCount: number;
  networks: { name: string; vlan_id: number | null; subnet: string | null }[];
  zoneType: string;
};

type ZoneNodeType = Node<ZoneNodeData, "zone">;

const ZONE_COLORS: Record<string, string> = {
  External: "border-red-400 bg-red-50 dark:bg-red-950/30",
  Internal: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  Guest: "border-green-400 bg-green-50 dark:bg-green-950/30",
  Hotspot: "border-green-400 bg-green-50 dark:bg-green-950/30",
  VPN: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  Gateway: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
  DMZ: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
};

const DEFAULT_COLOR = "border-gray-400 bg-gray-50 dark:bg-gray-800";

export function ZoneNode({ data }: NodeProps<ZoneNodeType>) {
  const colorClass = ZONE_COLORS[data.label] ?? DEFAULT_COLOR;

  return (
    <div className={`rounded-lg border-2 px-4 py-3 shadow-sm min-w-[200px] ${colorClass}`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{data.label}</span>
        <span className="rounded-full bg-white/60 dark:bg-black/20 px-2 py-0.5 text-xs">
          {data.networkCount} net{data.networkCount !== 1 ? "s" : ""}
        </span>
      </div>
      {data.networks.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {data.networks.map((n) => (
            <li key={n.name}>
              {n.name}
              {n.vlan_id != null && <span className="ml-1 text-gray-400">VLAN {n.vlan_id}</span>}
              {n.subnet && <span className="ml-1 text-gray-400">{n.subnet}</span>}
            </li>
          ))}
        </ul>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
```

**Step 4: Create custom RuleEdge**

Create `frontend/src/components/RuleEdge.tsx`:

```tsx
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";

export type RuleEdgeData = {
  ruleCount: number;
  allowCount: number;
  blockCount: number;
  sourceZoneName: string;
  destZoneName: string;
};

type RuleEdgeType = Edge<RuleEdgeData, "rule">;

function getEdgeColor(allowCount: number, blockCount: number): string {
  if (blockCount === 0 && allowCount > 0) return "#22c55e"; // green
  if (allowCount === 0 && blockCount > 0) return "#ef4444"; // red
  return "#f59e0b"; // amber
}

export function RuleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RuleEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data ? getEdgeColor(data.allowCount, data.blockCount) : "#999";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          opacity: selected ? 1 : 0.7,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nopan nodrag"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <span
            className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {data?.ruleCount ?? 0} rule{(data?.ruleCount ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

**Step 5: Create ZoneGraph component**

Create `frontend/src/components/ZoneGraph.tsx`:

```tsx
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ColorMode,
} from "@xyflow/react";

import type { Zone, ZonePair } from "../api/types";
import { getLayoutedElements } from "../utils/layout";
import { ZoneNode, type ZoneNodeData } from "./ZoneNode";
import { RuleEdge, type RuleEdgeData } from "./RuleEdge";

const nodeTypes = { zone: ZoneNode };
const edgeTypes = { rule: RuleEdge };

interface Props {
  zones: Zone[];
  zonePairs: ZonePair[];
  colorMode: ColorMode;
  onEdgeSelect: (pair: ZonePair | null) => void;
}

function buildGraph(zones: Zone[], zonePairs: ZonePair[]) {
  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z]));

  const nodes: Node<ZoneNodeData>[] = zones.map((z) => ({
    id: z.id,
    type: "zone",
    position: { x: 0, y: 0 },
    data: {
      label: z.name,
      networkCount: z.networks.length,
      networks: z.networks.map((n) => ({
        name: n.name,
        vlan_id: n.vlan_id,
        subnet: n.subnet,
      })),
      zoneType: z.name,
    },
  }));

  const edges: Edge<RuleEdgeData>[] = zonePairs.map((zp) => ({
    id: `${zp.source_zone_id}-${zp.destination_zone_id}`,
    source: zp.source_zone_id,
    target: zp.destination_zone_id,
    type: "rule",
    data: {
      ruleCount: zp.rules.length,
      allowCount: zp.allow_count,
      blockCount: zp.block_count,
      sourceZoneName: zoneMap[zp.source_zone_id]?.name ?? "?",
      destZoneName: zoneMap[zp.destination_zone_id]?.name ?? "?",
    },
  }));

  return getLayoutedElements(nodes, edges);
}

export function ZoneGraph({ zones, zonePairs, colorMode, onEdgeSelect }: Props) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildGraph(zones, zonePairs),
    [zones, zonePairs],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const pair = zonePairs.find(
        (zp) =>
          zp.source_zone_id === edge.source && zp.destination_zone_id === edge.target,
      );
      onEdgeSelect(pair ?? null);
    },
    [zonePairs, onEdgeSelect],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={onEdgeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode={colorMode}
      fitView
      minZoom={0.3}
      maxZoom={2}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Step 6: Commit**

```bash
git add frontend/src/components/ZoneNode.tsx frontend/src/components/RuleEdge.tsx frontend/src/components/ZoneGraph.tsx frontend/src/hooks/ frontend/src/utils/
git commit -m "feat: zone graph with custom nodes, edges, and dagre layout"
```

---

## Task 12: Frontend Rule Panel

**Files:**
- Create: `frontend/src/components/RulePanel.tsx`

**Step 1: Create RulePanel component**

Create `frontend/src/components/RulePanel.tsx`:

```tsx
import { useState } from "react";
import { api } from "../api/client";
import type { ZonePair, SimulateResponse } from "../api/types";

interface Props {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  onClose: () => void;
}

export function RulePanel({ pair, sourceZoneName, destZoneName, onClose }: Props) {
  const [srcIp, setSrcIp] = useState("");
  const [dstIp, setDstIp] = useState("");
  const [protocol, setProtocol] = useState("tcp");
  const [port, setPort] = useState("");
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [simError, setSimError] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimError("");
    setSimLoading(true);
    try {
      const result = await api.simulate({
        src_ip: srcIp,
        dst_ip: dstIp,
        protocol,
        port: port ? parseInt(port, 10) : null,
      });
      setSimResult(result);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {sourceZoneName} &rarr; {destZoneName}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          &times;
        </button>
      </div>

      {/* Rule List */}
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Rules ({pair.rules.length})
      </h3>
      <ul className="mb-6 space-y-2">
        {pair.rules.map((rule) => (
          <li
            key={rule.id}
            className={`rounded border px-3 py-2 text-sm ${
              !rule.enabled
                ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
                : rule.action === "ALLOW"
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
            } ${simResult?.matched_rule_id === rule.id ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{rule.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  !rule.enabled
                    ? "bg-gray-200 text-gray-500 dark:bg-gray-700"
                    : rule.action === "ALLOW"
                      ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                {rule.enabled ? rule.action : "DISABLED"}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {rule.protocol !== "all" && <span>Protocol: {rule.protocol} </span>}
              {rule.port_ranges.length > 0 && <span>Ports: {rule.port_ranges.join(", ")} </span>}
              {rule.predefined && <span className="italic">(predefined)</span>}
            </div>
          </li>
        ))}
      </ul>

      {/* Packet Simulation */}
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Test Packet
      </h3>
      <form onSubmit={handleSimulate} className="space-y-3">
        <input
          type="text"
          placeholder="Source IP (e.g. 192.168.1.50)"
          value={srcIp}
          onChange={(e) => setSrcIp(e.target.value)}
          required
          className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <input
          type="text"
          placeholder="Destination IP (e.g. 10.0.50.10)"
          value={dstIp}
          onChange={(e) => setDstIp(e.target.value)}
          required
          className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <div className="flex gap-2">
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
            <option value="all">Any</option>
          </select>
          <input
            type="number"
            placeholder="Port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
        <button
          type="submit"
          disabled={simLoading}
          className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {simLoading ? "Simulating..." : "Simulate"}
        </button>
      </form>

      {simError && (
        <div className="mt-3 rounded bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {simError}
        </div>
      )}

      {simResult && (
        <div className="mt-4">
          <div
            className={`mb-3 rounded-lg p-3 text-center text-sm font-semibold ${
              simResult.verdict === "ALLOW"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : simResult.verdict === "BLOCK" || simResult.verdict === "REJECT"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {simResult.verdict ?? "NO MATCH"}{" "}
            {simResult.matched_rule_name && `(${simResult.matched_rule_name})`}
            {simResult.default_policy_used && " -- default policy"}
          </div>

          <h4 className="mb-1 text-xs font-medium text-gray-500">Evaluation Chain</h4>
          <ul className="space-y-1 text-xs">
            {simResult.evaluations.map((ev) => (
              <li
                key={ev.rule_id}
                className={`rounded px-2 py-1 ${
                  ev.matched
                    ? "bg-blue-50 font-medium dark:bg-blue-950/30"
                    : ev.skipped_disabled
                      ? "text-gray-400"
                      : ""
                }`}
              >
                {ev.rule_name}: {ev.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/RulePanel.tsx
git commit -m "feat: rule side panel with packet simulation form"
```

---

## Task 13: Frontend Toolbar & Theme

**Files:**
- Create: `frontend/src/components/Toolbar.tsx`

**Step 1: Create Toolbar component**

Create `frontend/src/components/Toolbar.tsx`:

```tsx
import type { ColorMode } from "@xyflow/react";

interface Props {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  showDisabled: boolean;
  onShowDisabledChange: (show: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  onLogout: () => void;
}

export function Toolbar({
  colorMode,
  onColorModeChange,
  showDisabled,
  onShowDisabledChange,
  onRefresh,
  loading,
  onLogout,
}: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
      <h1 className="mr-auto text-lg font-semibold">UniFi Firewall Analyser</h1>

      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={showDisabled}
          onChange={(e) => onShowDisabledChange(e.target.checked)}
          className="rounded"
        />
        Show disabled rules
      </label>

      <button
        onClick={() => onColorModeChange(colorMode === "dark" ? "light" : "dark")}
        className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600"
      >
        {colorMode === "dark" ? "Light" : "Dark"}
      </button>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <button
        onClick={onLogout}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 dark:border-gray-600 dark:text-gray-400"
      >
        Disconnect
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Toolbar.tsx
git commit -m "feat: toolbar with theme toggle, refresh, and filters"
```

---

## Task 14: Wire Up App.tsx -- Full Integration

**Files:**
- Modify: `frontend/src/App.tsx` -- connect all components

**Step 1: Update App.tsx**

Replace `frontend/src/App.tsx`:

```tsx
import { useCallback, useState } from "react";
import type { ColorMode } from "@xyflow/react";

import { api } from "./api/client";
import type { ZonePair } from "./api/types";
import { useFirewallData } from "./hooks/useFirewallData";
import { LoginScreen } from "./components/LoginScreen";
import { ZoneGraph } from "./components/ZoneGraph";
import { RulePanel } from "./components/RulePanel";
import { Toolbar } from "./components/Toolbar";

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [showDisabled, setShowDisabled] = useState(true);
  const [selectedPair, setSelectedPair] = useState<ZonePair | null>(null);

  const { zones, zonePairs, loading, error, refresh } = useFirewallData();

  // Check auth status on mount
  useState(() => {
    api.getAuthStatus().then((s) => setAuthed(s.configured));
  });

  const handleLogout = useCallback(async () => {
    await api.logout();
    setAuthed(false);
  }, []);

  if (authed === null) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  // Filter zone pairs based on showDisabled
  const filteredPairs = showDisabled
    ? zonePairs
    : zonePairs.map((zp) => ({
        ...zp,
        rules: zp.rules.filter((r) => r.enabled),
      }));

  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <div className={`flex h-screen flex-col ${colorMode === "dark" ? "dark" : ""}`}>
      <Toolbar
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        showDisabled={showDisabled}
        onShowDisabledChange={setShowDisabled}
        onRefresh={refresh}
        loading={loading}
        onLogout={handleLogout}
      />

      {error && (
        <div className="bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <ZoneGraph
            zones={zones}
            zonePairs={filteredPairs}
            colorMode={colorMode}
            onEdgeSelect={setSelectedPair}
          />
        </div>

        {selectedPair && (
          <RulePanel
            pair={selectedPair}
            sourceZoneName={zoneMap[selectedPair.source_zone_id] ?? "Unknown"}
            destZoneName={zoneMap[selectedPair.destination_zone_id] ?? "Unknown"}
            onClose={() => setSelectedPair(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
```

Note: The `useState` call for initial auth check should use `useEffect` -- fix during implementation:

```tsx
useEffect(() => {
  api.getAuthStatus().then((s) => setAuthed(s.configured));
}, []);
```

**Step 2: Verify everything renders**

Run: `docker compose up`
Expected: Login screen appears. After login, zone graph renders with nodes and edges. Clicking an edge opens the rule panel.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire up all components into full application"
```

---

## Task 15: Docker Compose Polish

**Files:**
- Modify: `docker-compose.yml` -- finalize volumes and env
- Modify: `backend/Dockerfile` -- add production stage
- Modify: `frontend/Dockerfile` -- add dev config

**Step 1: Update docker-compose.yml for full dev experience**

Replace `docker-compose.yml`:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend/app:/app/app
    env_file:
      - .env
    environment:
      - PYTHONUNBUFFERED=1

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/index.html:/app/index.html
      - ./frontend/vite.config.ts:/app/vite.config.ts
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend
```

**Step 2: Update frontend vite.config.ts proxy for Docker**

The proxy target should work both locally (`localhost:8000`) and in Docker (`backend:8000`). In Docker, the frontend dev server runs inside the container but the browser accesses it from the host, so the proxy should still point to `localhost:8000` from the browser's perspective. However, the Vite dev server inside Docker needs to reach the backend container:

Update `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": process.env.VITE_API_URL || "http://localhost:8000",
    },
  },
});
```

**Step 3: Verify Docker Compose**

Run: `docker compose up --build`
Expected: Both services start, frontend proxies to backend, hot-reload works on file changes.

**Step 4: Commit**

```bash
git add docker-compose.yml frontend/vite.config.ts
git commit -m "chore: finalize Docker Compose for local development"
```

---

## Summary of Tasks

| Task | Description | Repo |
|------|-------------|------|
| 1 | PR to unifi-topology: firewall zone/policy/group fetching | unifi-topology |
| 2 | Project scaffolding: git, Docker, structure | firewall-analyser |
| 3 | Backend FastAPI skeleton | firewall-analyser |
| 4 | Backend auth router with env + runtime credentials | firewall-analyser |
| 5 | Backend firewall data service | firewall-analyser |
| 6 | Backend API endpoints: zones, rules, zone-pairs | firewall-analyser |
| 7 | Backend packet simulation engine with tests | firewall-analyser |
| 8 | Frontend scaffold: Vite + React + Tailwind | firewall-analyser |
| 9 | Frontend API client + types | firewall-analyser |
| 10 | Frontend login screen | firewall-analyser |
| 11 | Frontend zone graph: nodes, edges, layout | firewall-analyser |
| 12 | Frontend rule side panel with simulation | firewall-analyser |
| 13 | Frontend toolbar with theme toggle | firewall-analyser |
| 14 | Wire up App.tsx: full integration | firewall-analyser |
| 15 | Docker Compose polish | firewall-analyser |
