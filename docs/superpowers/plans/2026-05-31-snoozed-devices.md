# Snoozed Devices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users "snooze" an offline device so it is hidden from Topology and Metrics and stops generating anomaly notifications, until it reconnects and auto-unsnoozes.

**Architecture:** A server-side set of snoozed device MACs, persisted in SQLite, mirroring the existing `zone_filter` / `HiddenZoneRow` pattern. Topology and Metrics services exclude snoozed MACs; the background poller suppresses recording/alerts for them and auto-unsnoozes any that reappear online. The frontend adds snooze controls to the Metrics module and a Settings pane.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy + Alembic (SQLite); React 19, TypeScript, TanStack Query, Tailwind. Backend tests: pytest (98% coverage gate). Frontend tests: vitest (95% gate) + React Doctor (100/100).

**Spec:** `docs/superpowers/specs/2026-05-30-snoozed-devices-design.md`

**Conventions to follow:**
- MACs are stored and compared **lowercased** everywhere in this feature.
- Backend services use `get_session()` with try/finally close, structured logging via `structlog`.
- The pre-commit hook runs the full `make ci` pipeline on every commit; do not `--no-verify`.
- Commits must be signed (1Password SSH agent).

---

## File Structure

**Backend (create):**
- `backend/alembic/versions/010_snoozed_devices.py` — migration for the `snoozed_devices` table
- `backend/app/services/snoozed_devices.py` — snooze CRUD + reconcile service
- `backend/app/routers/snoozed_devices.py` — REST endpoints
- `backend/tests/test_snoozed_devices_service.py`
- `backend/tests/test_snoozed_devices_router.py`

**Backend (modify):**
- `backend/app/models_db.py` — add `SnoozedDeviceRow`
- `backend/app/models.py` — add `SnoozeInput`, `SnoozedDevice`, `SnoozeRequest`, `SnoozedDevicesResponse`
- `backend/app/services/metrics.py` — add `resolve_all_notifications`; filter snoozed in `get_latest_snapshots`
- `backend/app/services/topology.py` — filter snoozed in `get_topology_devices`
- `backend/app/services/poller.py` — reconcile-first + suppress snoozed
- `backend/app/main.py` — register the new router

**Frontend (create):**
- `frontend/src/components/SnoozedDevicesSection.tsx` — collapsible manage list
- `frontend/src/components/SnoozedDevicesSection.test.tsx`

**Frontend (modify):**
- `frontend/src/api/types.ts` — `SnoozedDevice`, `SnoozeDeviceInput`
- `frontend/src/api/client.ts` — `getSnoozedDevices`, `snoozeDevices`, `unsnoozeDevice`
- `frontend/src/hooks/queries.ts` — `useSnoozedDevices`, `useSnoozeDevices`, `useUnsnoozeDevice`
- `frontend/src/components/MetricsModule.tsx` — bulk action, per-card snooze overlay, render section
- `frontend/src/components/MetricsModule.test.tsx`
- `frontend/src/components/SettingsModal.tsx` — "Snoozed" tab + pane
- `frontend/src/components/SettingsModal.test.tsx`

---

## Task 1: Database table + migration

**Files:**
- Modify: `backend/app/models_db.py`
- Create: `backend/alembic/versions/010_snoozed_devices.py`

- [ ] **Step 1: Add the ORM model**

In `backend/app/models_db.py`, after the `HiddenZoneRow` class, add:

```python
class SnoozedDeviceRow(Base):
    __tablename__ = "snoozed_devices"

    mac: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model: Mapped[str] = mapped_column(Text, nullable=False, default="")
    snoozed_at: Mapped[str] = mapped_column(Text, nullable=False)
```

- [ ] **Step 2: Write the migration**

Create `backend/alembic/versions/010_snoozed_devices.py`:

```python
"""Add snoozed_devices table.

Revision ID: 010
Revises: 009
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS snoozed_devices (
            mac TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            snoozed_at TEXT NOT NULL
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS snoozed_devices")
```

- [ ] **Step 3: Verify the migration applies and the model imports**

Run: `docker compose exec -T api uv run python -c "from app.models_db import SnoozedDeviceRow; print(SnoozedDeviceRow.__tablename__)"`
Expected: prints `snoozed_devices`

Run: `docker compose exec -T api uv run alembic upgrade head`
Expected: completes without error (applies revision 010)

- [ ] **Step 4: Commit**

```bash
git add backend/app/models_db.py backend/alembic/versions/010_snoozed_devices.py
git commit -m "feat(snooze): add snoozed_devices table and migration"
```

---

## Task 2: Pydantic models

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add the models**

In `backend/app/models.py`, near the other small request/response models (e.g. after `MetricsDevicesResponse`), add:

```python
class SnoozeInput(BaseModel):
    mac: str
    name: str = ""
    model: str = ""


class SnoozedDevice(BaseModel):
    mac: str
    name: str
    model: str
    snoozed_at: str


class SnoozeRequest(BaseModel):
    devices: list[SnoozeInput]


class SnoozedDevicesResponse(BaseModel):
    devices: list[SnoozedDevice]
```

- [ ] **Step 2: Verify import**

Run: `docker compose exec -T api uv run python -c "from app.models import SnoozeInput, SnoozedDevice, SnoozeRequest, SnoozedDevicesResponse; print('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat(snooze): add snooze pydantic models"
```

---

## Task 3: `resolve_all_notifications` helper

**Files:**
- Modify: `backend/app/services/metrics.py`
- Test: `backend/tests/test_metrics_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_metrics_service.py`:

```python
def test_resolve_all_notifications_clears_every_check_for_device() -> None:
    from app.services.metrics import (
        create_notification,
        get_notifications,
        resolve_all_notifications,
    )

    create_notification("aa:bb", "high_cpu", "warning", "CPU", "high")
    create_notification("aa:bb", "high_memory", "warning", "Mem", "high")
    create_notification("cc:dd", "high_cpu", "warning", "CPU", "high")

    resolve_all_notifications("aa:bb")

    active = get_notifications(include_resolved=False)
    macs = {n.device_mac for n in active}
    assert "aa:bb" not in macs
    assert "cc:dd" in macs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest tests/test_metrics_service.py::test_resolve_all_notifications_clears_every_check_for_device -v`
Expected: FAIL with `ImportError` / `cannot import name 'resolve_all_notifications'`

- [ ] **Step 3: Implement**

In `backend/app/services/metrics.py`, add after `resolve_notifications`:

```python
def resolve_all_notifications(device_mac: str) -> None:
    """Resolve every active notification for a device, regardless of check type."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        rows = (
            session.query(NotificationRow)
            .filter(
                NotificationRow.device_mac == device_mac,
                NotificationRow.resolved_at.is_(None),
            )
            .all()
        )
        for row in rows:
            row.resolved_at = now
        if rows:
            session.commit()
            log.debug("notifications_resolved_all", device_mac=device_mac, count=len(rows))
    finally:
        session.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest tests/test_metrics_service.py::test_resolve_all_notifications_clears_every_check_for_device -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/metrics.py backend/tests/test_metrics_service.py
git commit -m "feat(snooze): add resolve_all_notifications helper"
```

---

## Task 4: Snooze service

**Files:**
- Create: `backend/app/services/snoozed_devices.py`
- Test: `backend/tests/test_snoozed_devices_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_snoozed_devices_service.py`:

```python
"""Tests for the snoozed devices service."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.database import init_db_for_tests, reset_engine
from app.models import SnoozeInput
from app.services.metrics import create_notification, get_notifications
from app.services.snoozed_devices import (
    get_snoozed,
    get_snoozed_macs,
    reconcile_online,
    snooze_devices,
    unsnooze_device,
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


def test_snooze_and_list() -> None:
    snooze_devices([SnoozeInput(mac="AA:BB:CC", name="Switch", model="USW")])
    rows = get_snoozed()
    assert len(rows) == 1
    assert rows[0].mac == "aa:bb:cc"  # stored lowercased
    assert rows[0].name == "Switch"
    assert rows[0].snoozed_at  # non-empty timestamp
    assert get_snoozed_macs() == {"aa:bb:cc"}


def test_snooze_is_idempotent() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="First", model="m")])
    snooze_devices([SnoozeInput(mac="AA:BB", name="Second", model="m")])
    rows = get_snoozed()
    assert len(rows) == 1
    assert rows[0].name == "First"  # original kept


def test_snooze_resolves_active_notifications() -> None:
    create_notification("aa:bb", "high_cpu", "warning", "CPU", "high")
    snooze_devices([SnoozeInput(mac="AA:BB", name="x", model="y")])
    active = get_notifications(include_resolved=False)
    assert all(n.device_mac != "aa:bb" for n in active)


def test_unsnooze_removes_device() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    unsnooze_device("AA:BB")
    assert get_snoozed_macs() == set()


def test_unsnooze_missing_is_noop() -> None:
    unsnooze_device("zz:zz")  # should not raise
    assert get_snoozed_macs() == set()


def test_reconcile_online_unsnoozes_reconnected() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    snooze_devices([SnoozeInput(mac="cc:dd", name="x", model="y")])
    reenabled = reconcile_online({"AA:BB"})
    assert reenabled == ["aa:bb"]
    assert get_snoozed_macs() == {"cc:dd"}


def test_reconcile_online_no_matches() -> None:
    snooze_devices([SnoozeInput(mac="aa:bb", name="x", model="y")])
    assert reconcile_online({"ee:ff"}) == []
    assert get_snoozed_macs() == {"aa:bb"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest tests/test_snoozed_devices_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.snoozed_devices'`

- [ ] **Step 3: Implement the service**

Create `backend/app/services/snoozed_devices.py`:

```python
"""Snoozed devices persistence service.

A snoozed device (by MAC) is hidden from views and excluded from anomaly
processing until it reconnects. Mirrors the zone_filter persistence pattern.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import delete, select

from app.database import get_session
from app.models import SnoozedDevice, SnoozeInput
from app.models_db import SnoozedDeviceRow
from app.services.metrics import resolve_all_notifications

log = structlog.get_logger()


def get_snoozed() -> list[SnoozedDevice]:
    """Return all snoozed devices, newest first."""
    session = get_session()
    try:
        rows = (
            session.execute(select(SnoozedDeviceRow).order_by(SnoozedDeviceRow.snoozed_at.desc()))
            .scalars()
            .all()
        )
        return [
            SnoozedDevice(mac=r.mac, name=r.name, model=r.model, snoozed_at=r.snoozed_at)
            for r in rows
        ]
    finally:
        session.close()


def get_snoozed_macs() -> set[str]:
    """Return the set of snoozed MACs (lowercased)."""
    session = get_session()
    try:
        macs = session.execute(select(SnoozedDeviceRow.mac)).scalars().all()
        return {m.lower() for m in macs}
    finally:
        session.close()


def snooze_devices(devices: list[SnoozeInput]) -> None:
    """Snooze one or many devices. Already-snoozed devices keep their timestamp."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        existing = {m.lower() for m in session.execute(select(SnoozedDeviceRow.mac)).scalars().all()}
        added: list[str] = []
        for device in devices:
            mac = device.mac.lower()
            if mac in existing:
                continue
            session.add(SnoozedDeviceRow(mac=mac, name=device.name, model=device.model, snoozed_at=now))
            existing.add(mac)
            added.append(mac)
        if added:
            session.commit()
            log.info("devices_snoozed", macs=added)
    finally:
        session.close()
    for mac in {d.mac.lower() for d in devices}:
        resolve_all_notifications(mac)


def unsnooze_device(mac: str) -> None:
    """Remove a device from the snoozed set (idempotent)."""
    session = get_session()
    try:
        session.execute(delete(SnoozedDeviceRow).where(SnoozedDeviceRow.mac == mac.lower()))
        session.commit()
        log.info("device_unsnoozed", mac=mac.lower())
    finally:
        session.close()


def reconcile_online(online_macs: set[str]) -> list[str]:
    """Auto-unsnooze any snoozed device that is now online. Returns re-enabled MACs."""
    online = {m.lower() for m in online_macs}
    session = get_session()
    try:
        snoozed = {m.lower() for m in session.execute(select(SnoozedDeviceRow.mac)).scalars().all()}
        to_enable = sorted(snoozed & online)
        if to_enable:
            session.execute(delete(SnoozedDeviceRow).where(SnoozedDeviceRow.mac.in_(to_enable)))
            session.commit()
            log.info("devices_auto_unsnoozed", macs=to_enable)
        return to_enable
    finally:
        session.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest tests/test_snoozed_devices_service.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/snoozed_devices.py backend/tests/test_snoozed_devices_service.py
git commit -m "feat(snooze): add snoozed devices service"
```

---

## Task 5: Snooze router

**Files:**
- Create: `backend/app/routers/snoozed_devices.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_snoozed_devices_router.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_snoozed_devices_router.py`:

```python
"""Tests for the snoozed devices router."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db_for_tests, reset_engine


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


@pytest.mark.anyio
async def test_list_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/devices/snoozed")
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}


@pytest.mark.anyio
async def test_snooze_then_list(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/devices/snoozed",
        json={"devices": [{"mac": "AA:BB", "name": "Switch", "model": "USW"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["devices"]) == 1
    assert data["devices"][0]["mac"] == "aa:bb"
    assert data["devices"][0]["name"] == "Switch"


@pytest.mark.anyio
async def test_unsnooze(client: AsyncClient) -> None:
    await client.post(
        "/api/devices/snoozed",
        json={"devices": [{"mac": "aa:bb", "name": "x", "model": "y"}]},
    )
    resp = await client.request("DELETE", "/api/devices/snoozed/AA:BB")
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest tests/test_snoozed_devices_router.py -v`
Expected: FAIL (404 responses — router not registered)

- [ ] **Step 3: Implement the router**

Create `backend/app/routers/snoozed_devices.py`:

```python
"""Router for snoozed device management."""

import structlog
from fastapi import APIRouter

from app.models import SnoozedDevicesResponse, SnoozeRequest
from app.services.snoozed_devices import get_snoozed, snooze_devices, unsnooze_device

log = structlog.get_logger()

router = APIRouter(tags=["snoozed-devices"])


@router.get("/snoozed")
async def list_snoozed() -> SnoozedDevicesResponse:
    return SnoozedDevicesResponse(devices=get_snoozed())


@router.post("/snoozed")
async def snooze(body: SnoozeRequest) -> SnoozedDevicesResponse:
    log.info("snooze_request", count=len(body.devices))
    snooze_devices(body.devices)
    return SnoozedDevicesResponse(devices=get_snoozed())


@router.delete("/snoozed/{mac}")
async def unsnooze(mac: str) -> SnoozedDevicesResponse:
    log.info("unsnooze_request", mac=mac)
    unsnooze_device(mac)
    return SnoozedDevicesResponse(devices=get_snoozed())
```

- [ ] **Step 4: Register the router**

In `backend/app/main.py`, add the import alongside the other router imports (after `from app.routers.settings import router as settings_router`):

```python
from app.routers.snoozed_devices import router as snoozed_devices_router
```

And register it near the metrics router registration (after `app.include_router(metrics_router, prefix="/api/metrics")`):

```python
app.include_router(snoozed_devices_router, prefix="/api/devices")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest tests/test_snoozed_devices_router.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/snoozed_devices.py backend/app/main.py backend/tests/test_snoozed_devices_router.py
git commit -m "feat(snooze): add snoozed devices router"
```

---

## Task 6: Filter snoozed devices out of Topology

**Files:**
- Modify: `backend/app/services/topology.py`
- Test: `backend/tests/test_topology_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_topology_service.py` inside `class TestGetTopologyDevices`:

```python
    def test_snoozed_devices_are_excluded(self) -> None:
        from app.database import init_db_for_tests, reset_engine
        from app.models import SnoozeInput
        from app.services.snoozed_devices import snooze_devices

        init_db_for_tests("/tmp/topo_snooze_test.db")  # noqa: S108
        try:
            snooze_devices([SnoozeInput(mac="aa:bb:cc:dd:ee:02", name="Switch", model="USW")])
            with _patch_all():
                result = get_topology_devices(MOCK_CONFIG)
            macs = {d.mac for d in result.devices}
            assert "aa:bb:cc:dd:ee:02" not in macs
            # edges touching the snoozed device are dropped too
            assert all("aa:bb:cc:dd:ee:02" not in (e.from_mac, e.to_mac) for e in result.edges)
        finally:
            reset_engine()
```

> Note: `_patch_all()` and `MOCK_CONFIG` already exist in this test file. The default mock devices include `aa:bb:cc:dd:ee:02` ("Switch").

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest "tests/test_topology_service.py::TestGetTopologyDevices::test_snoozed_devices_are_excluded" -v`
Expected: FAIL — `aa:bb:cc:dd:ee:02` still present in devices

- [ ] **Step 3: Implement the filter**

In `backend/app/services/topology.py`, add the import near the top with the other `app.services` imports:

```python
from app.services.snoozed_devices import get_snoozed_macs
```

In `get_topology_devices`, change the line that builds `devices`:

```python
    devices = normalize_devices(raw_devices)
```

to:

```python
    snoozed = get_snoozed_macs()
    devices = [d for d in normalize_devices(raw_devices) if d.mac.lower() not in snoozed]
```

(The existing edge loop already drops edges whose endpoints are not in `device_mac_set`, so excluding the devices also drops their edges — no further change needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest "tests/test_topology_service.py::TestGetTopologyDevices::test_snoozed_devices_are_excluded" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/topology.py backend/tests/test_topology_service.py
git commit -m "feat(snooze): exclude snoozed devices from topology"
```

---

## Task 7: Filter snoozed devices out of Metrics

**Files:**
- Modify: `backend/app/services/metrics.py`
- Test: `backend/tests/test_metrics_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_metrics_service.py`:

```python
def test_get_latest_snapshots_excludes_snoozed() -> None:
    from app.models import SnoozeInput
    from app.services.metrics import get_latest_snapshots, record_snapshot
    from app.services.snoozed_devices import snooze_devices
    from unifi_topology import DeviceStats

    record_snapshot([
        DeviceStats(mac="aa:bb", name="A", model="m", type="switch", cpu=1, mem=1, uptime=1, version="1", poe_ports=[], poe_budget=None),
        DeviceStats(mac="cc:dd", name="B", model="m", type="switch", cpu=1, mem=1, uptime=1, version="1", poe_ports=[], poe_budget=None),
    ])
    snooze_devices([SnoozeInput(mac="AA:BB", name="A", model="m")])

    snapshots = get_latest_snapshots()
    macs = {s.mac for s in snapshots}
    assert "aa:bb" not in macs
    assert "cc:dd" in macs
```

> This test relies on the module's existing `_test_db` autouse fixture (already present in `test_metrics_service.py`).

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest tests/test_metrics_service.py::test_get_latest_snapshots_excludes_snoozed -v`
Expected: FAIL — `aa:bb` still in snapshots

- [ ] **Step 3: Implement the filter**

In `backend/app/services/metrics.py`, inside `get_latest_snapshots`, import and apply the snoozed filter. Add the import inside the function (to avoid a circular import, since `snoozed_devices` imports from `metrics`):

Find the start of the `snapshots: list[MetricsSnapshot] = []` loop and add the filter just before it:

```python
    from app.services.snoozed_devices import get_snoozed_macs

    snoozed = get_snoozed_macs()

    snapshots: list[MetricsSnapshot] = []
    for row in rows:
        if row.mac.lower() in snoozed:
            continue
        live = stats_lookup.get(row.mac)
        ...
```

(Keep the rest of the loop body unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest tests/test_metrics_service.py::test_get_latest_snapshots_excludes_snoozed -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/metrics.py backend/tests/test_metrics_service.py
git commit -m "feat(snooze): exclude snoozed devices from metrics list"
```

---

## Task 8: Poller — reconcile-first + suppression

**Files:**
- Modify: `backend/app/services/poller.py`
- Test: `backend/tests/test_poller.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_poller.py` inside `class TestStartMetricsPoller`:

```python
    @pytest.mark.anyio
    async def test_snoozed_devices_are_suppressed_and_reconciled(self) -> None:
        from app.models import SnoozeInput
        from app.services.poller import _poll_once
        from app.services.snoozed_devices import get_snoozed_macs, snooze_devices

        # Two devices snoozed; only "aa:bb" comes back online in the poll.
        snooze_devices([SnoozeInput(mac="aa:bb", name="A", model="m")])
        snooze_devices([SnoozeInput(mac="cc:dd", name="B", model="m")])

        online = [_make_stats(mac="aa:bb")]
        recorded: list[list[object]] = []

        with (
            patch("app.services.poller.has_credentials", return_value=True),
            patch("app.services.poller.get_unifi_config", return_value=MagicMock()),
            patch("app.services.poller.to_topology_config", return_value=MagicMock()),
            patch("app.services.poller.fetch_device_stats", return_value=[]),
            patch("app.services.poller.normalize_device_stats", return_value=online),
            patch("app.services.poller.record_snapshot", side_effect=lambda s: recorded.append(s)),
            patch("app.services.poller._check_anomalies"),
            patch("app.services.poller._maybe_prune"),
        ):
            _poll_once()

        # aa:bb reconnected -> auto-unsnoozed and recorded; cc:dd stays snoozed.
        assert get_snoozed_macs() == {"cc:dd"}
        assert recorded and {s.mac for s in recorded[0]} == {"aa:bb"}
```

> `_make_stats` and the `_test_db` + `_reset_poller_state` fixtures already exist in `test_poller.py`. Add `_test_db` (init_db_for_tests) if the module lacks it — verify the module's existing autouse fixtures first; `test_poller.py` already has `_test_db`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T api uv run pytest "tests/test_poller.py::TestStartMetricsPoller::test_snoozed_devices_are_suppressed_and_reconciled" -v`
Expected: FAIL — `cc:dd` and `aa:bb` both still snoozed, or `recorded` includes a snoozed device

- [ ] **Step 3: Implement**

In `backend/app/services/poller.py`, add the import near the top:

```python
from app.services.snoozed_devices import get_snoozed_macs, reconcile_online
```

Replace the body of `_poll_once` (the part after fetching stats) so it reconciles first, then suppresses:

```python
def _poll_once() -> None:
    """Execute a single metrics poll cycle (blocking)."""
    if not has_credentials():
        return
    credentials = get_unifi_config()
    assert credentials is not None
    config = to_topology_config(credentials)
    raw_stats = fetch_device_stats(config, site=credentials.site)
    stats = normalize_device_stats(raw_stats)  # type: ignore[arg-type]

    # Auto-unsnooze any snoozed device that is back online, then drop those that
    # are still snoozed so they produce no snapshots or notifications.
    online_macs = {s.mac.lower() for s in stats}
    reconcile_online(online_macs)
    snoozed = get_snoozed_macs()
    active_stats = [s for s in stats if s.mac.lower() not in snoozed]

    record_snapshot(active_stats)
    _check_anomalies(active_stats)
    _maybe_prune()
    set_controller_health("ok")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T api uv run pytest "tests/test_poller.py::TestStartMetricsPoller::test_snoozed_devices_are_suppressed_and_reconciled" -v`
Expected: PASS

- [ ] **Step 5: Run the full backend suite + quality gates**

Run: `docker compose exec -T api uv run pytest -q`
Expected: PASS, total coverage ≥ 98%

Run: `docker compose exec -T api uv run ruff check app/ && docker compose exec -T api uv run mypy app/`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/poller.py backend/tests/test_poller.py
git commit -m "feat(snooze): poller reconciles online devices and suppresses snoozed ones"
```

---

## Task 9: Frontend types + API client

**Files:**
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Add the types**

In `frontend/src/api/types.ts`, add:

```typescript
export interface SnoozedDevice {
  mac: string;
  name: string;
  model: string;
  snoozed_at: string;
}

export interface SnoozeDeviceInput {
  mac: string;
  name: string;
  model: string;
}

export interface SnoozedDevicesResponse {
  devices: SnoozedDevice[];
}
```

- [ ] **Step 2: Write the failing client test**

Add to `frontend/src/api/client.test.ts` (follow the existing `describe`/mockFetch pattern in that file):

```typescript
  describe("snoozed devices", () => {
    it("gets the snoozed list", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ devices: [] }));
      await api.getSnoozedDevices();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/devices/snoozed");
    });

    it("posts devices to snooze", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ devices: [] }));
      await api.snoozeDevices([{ mac: "aa:bb", name: "A", model: "m" }]);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/devices/snoozed");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ devices: [{ mac: "aa:bb", name: "A", model: "m" }] });
    });

    it("deletes (unsnoozes) by mac", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ devices: [] }));
      await api.unsnoozeDevice("aa:bb");
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/devices/snoozed/aa%3Abb");
      expect(init.method).toBe("DELETE");
    });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `docker compose exec -T frontend npx vitest run src/api/client.test.ts -t "snoozed devices"`
Expected: FAIL — `api.getSnoozedDevices is not a function`

- [ ] **Step 4: Implement the client endpoints**

In `frontend/src/api/client.ts`, add `SnoozedDevicesResponse` and `SnoozeDeviceInput` to the type import block, then add to the `api` object (near `getMetricsDevices`):

```typescript
  getSnoozedDevices: () => fetchJson<SnoozedDevicesResponse>("/devices/snoozed"),
  snoozeDevices: (devices: SnoozeDeviceInput[]) =>
    fetchJson<SnoozedDevicesResponse>("/devices/snoozed", {
      method: "POST",
      body: JSON.stringify({ devices }),
    }),
  unsnoozeDevice: (mac: string) =>
    fetchJson<SnoozedDevicesResponse>(`/devices/snoozed/${encodeURIComponent(mac)}`, {
      method: "DELETE",
    }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose exec -T frontend npx vitest run src/api/client.test.ts -t "snoozed devices"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(snooze): add snooze API client + types"
```

---

## Task 10: Frontend query hooks

**Files:**
- Modify: `frontend/src/hooks/queries.ts`
- Test: `frontend/src/hooks/queries.test.ts` (if absent, create following the existing hook-test pattern in the repo)

- [ ] **Step 1: Write the failing test**

Add to the frontend hooks tests (create `frontend/src/hooks/queries.snooze.test.tsx` if there is no existing queries test to extend). Use the project's `renderHook` + `QueryClientProvider` pattern (see `src/test-utils`):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSnoozedDevices, useSnoozeDevices, useUnsnoozeDevice } from "./queries";

vi.mock("../api/client", () => ({
  api: {
    getSnoozedDevices: vi.fn().mockResolvedValue({ devices: [] }),
    snoozeDevices: vi.fn().mockResolvedValue({ devices: [] }),
    unsnoozeDevice: vi.fn().mockResolvedValue({ devices: [] }),
  },
}));
import { api } from "../api/client";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("snooze hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches snoozed devices when enabled", async () => {
    renderHook(() => useSnoozedDevices(true), { wrapper });
    await waitFor(() => expect(api.getSnoozedDevices).toHaveBeenCalled());
  });

  it("snoozes devices", async () => {
    const { result } = renderHook(() => useSnoozeDevices(), { wrapper });
    result.current.mutate([{ mac: "aa:bb", name: "A", model: "m" }]);
    await waitFor(() => expect(api.snoozeDevices).toHaveBeenCalledWith([{ mac: "aa:bb", name: "A", model: "m" }]));
  });

  it("unsnoozes a device", async () => {
    const { result } = renderHook(() => useUnsnoozeDevice(), { wrapper });
    result.current.mutate("aa:bb");
    await waitFor(() => expect(api.unsnoozeDevice).toHaveBeenCalledWith("aa:bb"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T frontend npx vitest run src/hooks/queries.snooze.test.tsx`
Expected: FAIL — hooks not exported

- [ ] **Step 3: Implement the hooks**

In `frontend/src/hooks/queries.ts`:

Add `SnoozeDeviceInput` to the type import line.

Add to `queryKeys`:

```typescript
  snoozedDevices: ["snoozed-devices"] as const,
```

Add the hooks (near the metrics hooks / mutations):

```typescript
export function useSnoozedDevices(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.snoozedDevices,
    queryFn: api.getSnoozedDevices,
    enabled,
  });
}

function invalidateSnoozeRelated(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.snoozedDevices });
  qc.invalidateQueries({ queryKey: queryKeys.metricsDevices });
  qc.invalidateQueries({ queryKey: queryKeys.topologyDevices });
  qc.invalidateQueries({ queryKey: queryKeys.notifications });
}

export function useSnoozeDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (devices: SnoozeDeviceInput[]) => api.snoozeDevices(devices),
    onSuccess: () => invalidateSnoozeRelated(qc),
  });
}

export function useUnsnoozeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mac: string) => api.unsnoozeDevice(mac),
    onSuccess: () => invalidateSnoozeRelated(qc),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T frontend npx vitest run src/hooks/queries.snooze.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/queries.ts frontend/src/hooks/queries.snooze.test.tsx
git commit -m "feat(snooze): add snooze query hooks"
```

---

## Task 11: `SnoozedDevicesSection` component

**Files:**
- Create: `frontend/src/components/SnoozedDevicesSection.tsx`
- Test: `frontend/src/components/SnoozedDevicesSection.test.tsx`

A reusable collapsible list of snoozed devices with an Unsnooze button per row. Used by both the Metrics module and the Settings pane.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/SnoozedDevicesSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SnoozedDevicesSection from "./SnoozedDevicesSection";

const devices = [
  { mac: "aa:bb", name: "Switch", model: "USW", snoozed_at: "2026-05-31T10:00:00Z" },
];

describe("SnoozedDevicesSection", () => {
  it("renders nothing when there are no snoozed devices", () => {
    const { container } = render(<SnoozedDevicesSection devices={[]} onUnsnooze={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count and expands to list devices", () => {
    render(<SnoozedDevicesSection devices={devices} onUnsnooze={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Snoozed devices \(1\)/ }));
    expect(screen.getByText("Switch")).toBeInTheDocument();
  });

  it("calls onUnsnooze with the mac", () => {
    const onUnsnooze = vi.fn();
    render(<SnoozedDevicesSection devices={devices} onUnsnooze={onUnsnooze} defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Unsnooze Switch" }));
    expect(onUnsnooze).toHaveBeenCalledWith("aa:bb");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T frontend npx vitest run src/components/SnoozedDevicesSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `frontend/src/components/SnoozedDevicesSection.tsx`:

```tsx
import { useState } from "react";
import type { SnoozedDevice } from "../api/types";

interface SnoozedDevicesSectionProps {
  devices: SnoozedDevice[];
  onUnsnooze: (mac: string) => void;
  defaultOpen?: boolean;
}

export default function SnoozedDevicesSection({ devices, onUnsnooze, defaultOpen = false }: SnoozedDevicesSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (devices.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-ui-border dark:border-noc-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
      >
        <span>Snoozed devices ({devices.length})</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-ui-border dark:divide-noc-border">
          {devices.map((device) => (
            <li key={device.mac} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ui-text dark:text-noc-text">{device.name || device.mac}</p>
                <p className="truncate text-xs text-ui-text-dim dark:text-noc-text-dim">{device.model || device.mac}</p>
              </div>
              <button
                type="button"
                onClick={() => onUnsnooze(device.mac)}
                aria-label={`Unsnooze ${device.name || device.mac}`}
                className="shrink-0 rounded-md border border-ui-border dark:border-noc-border px-3 py-1 text-xs text-ub-blue hover:bg-ub-blue-dim transition-colors"
              >
                Unsnooze
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T frontend npx vitest run src/components/SnoozedDevicesSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SnoozedDevicesSection.tsx frontend/src/components/SnoozedDevicesSection.test.tsx
git commit -m "feat(snooze): add SnoozedDevicesSection component"
```

---

## Task 12: Metrics module integration

**Files:**
- Modify: `frontend/src/components/MetricsModule.tsx`
- Test: `frontend/src/components/MetricsModule.test.tsx`

Add (a) a "Snooze offline (N)" bulk button in the header when offline devices exist, (b) a per-card "Snooze" overlay button on offline cards (status !== "online"), rendered as a sibling of the card button inside a `relative` wrapper (avoids nesting buttons), and (c) the `SnoozedDevicesSection` below the grid.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/MetricsModule.test.tsx` (follow the file's existing mock setup; it mocks `../hooks/queries`). Ensure the mock provides `useSnoozedDevices`, `useSnoozeDevices`, `useUnsnoozeDevice`. Example test:

```tsx
  it("shows a bulk snooze button and snoozes offline devices", () => {
    mockUseMetricsDevices.mockReturnValue({
      data: { devices: [
        { mac: "aa:bb", name: "Online", model: "m", status: "online" },
        { mac: "cc:dd", name: "Dead", model: "m", status: "unknown" },
      ] },
      isLoading: false,
      error: null,
    });
    const snooze = vi.fn();
    mockUseSnoozeDevices.mockReturnValue({ mutate: snooze, isPending: false });

    renderModule();

    fireEvent.click(screen.getByRole("button", { name: /Snooze offline \(1\)/ }));
    expect(snooze).toHaveBeenCalledWith([{ mac: "cc:dd", name: "Dead", model: "m" }]);
  });
```

> Match the exact mock helper names already used in `MetricsModule.test.tsx`. If the file does not yet mock the snooze hooks, add them to the `vi.mock("../hooks/queries", ...)` factory returning `useSnoozedDevices: () => ({ data: { devices: [] } })`, `useSnoozeDevices: () => ({ mutate: vi.fn() })`, `useUnsnoozeDevice: () => ({ mutate: vi.fn() })`, then override per-test as needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T frontend npx vitest run src/components/MetricsModule.test.tsx -t "bulk snooze"`
Expected: FAIL — no such button

- [ ] **Step 3: Implement**

In `frontend/src/components/MetricsModule.tsx`:

Add imports:

```typescript
import { useMetricsDevices, useMetricsHistory, useNotifications, useSnoozedDevices, useSnoozeDevices, useUnsnoozeDevice } from "../hooks/queries";
import SnoozedDevicesSection from "./SnoozedDevicesSection";
```

Inside the component, after the existing query hooks, add:

```typescript
  const snoozedQuery = useSnoozedDevices(authed);
  const snoozeMutation = useSnoozeDevices();
  const unsnoozeMutation = useUnsnoozeDevice();

  const snoozed = snoozedQuery.data?.devices ?? [];
  const offlineDevices = devices.filter((d) => d.status !== "online");

  const snoozeDevice = (device: { mac: string; name: string; model: string }) =>
    snoozeMutation.mutate([{ mac: device.mac, name: device.name, model: device.model }]);
```

In the header bar (the `div` containing "Auto-refreshes every 30s"), add a bulk button when there are offline devices:

```tsx
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim">Auto-refreshes every 30s</span>
        {offlineDevices.length > 0 && (
          <button
            type="button"
            onClick={() => snoozeMutation.mutate(offlineDevices.map((d) => ({ mac: d.mac, name: d.name, model: d.model })))}
            className="ml-auto rounded-md border border-ui-border dark:border-noc-border px-3 py-1 text-xs text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
          >
            Snooze offline ({offlineDevices.length})
          </button>
        )}
```

In the device grid, wrap each card so an offline card gets a snooze overlay (replace the existing `devices.map(...)` block):

```tsx
                {devices.map((device) => (
                  <div key={device.mac} className="relative">
                    <DeviceMetricCard
                      device={device}
                      onClick={() => {
                        setSelectedMac(device.mac);
                        window.history.pushState({ view: "detail" }, "");
                      }}
                    />
                    {device.status !== "online" && (
                      <button
                        type="button"
                        onClick={() => snoozeDevice(device)}
                        aria-label={`Snooze ${device.name || device.mac}`}
                        className="absolute right-2 top-2 rounded-md bg-ui-surface/90 dark:bg-noc-surface/90 border border-ui-border dark:border-noc-border px-2 py-0.5 text-xs text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
                      >
                        Snooze
                      </button>
                    )}
                  </div>
                ))}
```

After the grid container (inside the same scroll area, after the `grid` div), render the manage section:

```tsx
            <SnoozedDevicesSection devices={snoozed} onUnsnooze={(mac) => unsnoozeMutation.mutate(mac)} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T frontend npx vitest run src/components/MetricsModule.test.tsx`
Expected: PASS (existing tests still pass + the new one)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MetricsModule.tsx frontend/src/components/MetricsModule.test.tsx
git commit -m "feat(snooze): metrics snooze controls (bulk, per-card, manage section)"
```

---

## Task 13: Settings "Snoozed devices" pane

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Test: `frontend/src/components/SettingsModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/SettingsModal.test.tsx`:

```tsx
  it("shows the Snoozed devices tab and lists snoozed devices", () => {
    const mockUseSnoozed = vi.mocked(useSnoozedDevices);
    mockUseSnoozed.mockReturnValue({ data: { devices: [
      { mac: "aa:bb", name: "Dead Switch", model: "USW", snoozed_at: "2026-05-31T10:00:00Z" },
    ] } } as ReturnType<typeof useSnoozedDevices>);

    renderModal(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: /Snoozed/ }));
    fireEvent.click(screen.getByRole("button", { name: /Snoozed devices \(1\)/ }));
    expect(screen.getByText("Dead Switch")).toBeInTheDocument();
  });
```

> Add `useSnoozedDevices` and `useUnsnoozeDevice` to the `vi.mock("../hooks/queries", ...)` factory in this test file (default: `{ data: { devices: [] } }` and `{ mutate: vi.fn() }`).

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T frontend npx vitest run src/components/SettingsModal.test.tsx -t "Snoozed devices tab"`
Expected: FAIL — no "Snoozed" tab

- [ ] **Step 3: Implement**

In `frontend/src/components/SettingsModal.tsx`:

Extend the tab union:

```typescript
type SettingsTab = "connection" | "ai" | "user" | "snoozed";
```

Add imports:

```typescript
import { useSnoozedDevices, useUnsnoozeDevice } from "../hooks/queries";
import SnoozedDevicesSection from "./SnoozedDevicesSection";
```

Add a `SnoozedPane` component (near the other panes):

```tsx
function SnoozedPane() {
  const { connectionInfo } = useAppContext();
  const snoozedQuery = useSnoozedDevices(connectionInfo !== null);
  const unsnoozeMutation = useUnsnoozeDevice();
  const devices = snoozedQuery.data?.devices ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">
        Snoozed devices are hidden from Topology and Metrics and stop generating alerts. They return automatically when they reconnect.
      </p>
      {devices.length === 0 ? (
        <p className="text-sm text-ui-text-dim dark:text-noc-text-dim">No snoozed devices.</p>
      ) : (
        <SnoozedDevicesSection devices={devices} onUnsnooze={(mac) => unsnoozeMutation.mutate(mac)} defaultOpen />
      )}
    </div>
  );
}
```

Add the tab button to the tab row (next to the existing TabButtons) and render the pane when `tab === "snoozed"`. Match the existing `TabButton` usage pattern:

```tsx
        <TabButton icon={<MoonZzIcon />} label="Snoozed" active={tab === "snoozed"} onClick={() => setTab("snoozed")} />
```

```tsx
        {tab === "snoozed" && <SnoozedPane />}
```

For `MoonZzIcon`, reuse an existing icon from the file (e.g. the icon used for the User tab) rather than adding a new SVG, to keep scope tight — pick whichever existing icon component reads sensibly; a plain reuse is fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T frontend npx vitest run src/components/SettingsModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all frontend gates**

Run: `docker compose exec -T frontend npx tsc --noEmit`
Run: `docker compose exec -T frontend npx eslint src/ --no-warn-ignored`
Run: `docker compose exec -T frontend npx vitest run --coverage` (expect ≥ 95% all metrics)
Run: `cd frontend && npx react-doctor . --yes` (expect 100/100)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx
git commit -m "feat(snooze): add Snoozed devices settings pane"
```

---

## Final verification

- [ ] Run the full backend suite: `docker compose exec -T api uv run pytest -q` (≥ 98%).
- [ ] Run the full frontend suite with coverage: `docker compose exec -T frontend npx vitest run --coverage` (≥ 95%).
- [ ] `make complexity` and `make quality` clean; React Doctor 100/100.
- [ ] Manual smoke (optional): with the app running, take a device offline (or mock), confirm a Snooze button appears on its Metrics card, snooze it, confirm it disappears from Metrics and Topology and appears under "Snoozed devices", then confirm it auto-returns when back online within ~30s.

---

## Self-review notes (addressed)

- **Spec coverage:** data model (T1), models (T2), service incl. reconcile + notification clearing (T3, T4), router + registration (T5), topology filter (T6), metrics filter (T7), poller reconcile-first + suppression (T8), frontend types/client (T9), hooks (T10), manage section (T11), Metrics per-device + bulk + manage (T12), Settings pane (T13). All spec sections map to a task.
- **MAC casing:** stored and compared lowercased throughout (service, filters, poller).
- **Circular import:** `snoozed_devices` imports from `metrics`; `metrics.get_latest_snapshots` imports `get_snoozed_macs` *inside the function* to avoid a cycle (T7 Step 3).
- **Button nesting:** per-card snooze is a sibling overlay, not nested in the card `<button>` (T12), keeping React Doctor at 100.
