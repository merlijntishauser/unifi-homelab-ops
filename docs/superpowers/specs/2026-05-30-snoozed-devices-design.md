# Snoozed Devices — Design

Date: 2026-05-30
Status: Approved (pending spec review)

## Summary

Add a "snoozed device" concept to UniFi Homelab Ops. A snoozed device (identified
by MAC) is hidden from the Topology and Metrics views and excluded from anomaly
processing, until it reconnects — at which point it auto-unsnoozes. Snoozing is
offered for offline devices; a manual unsnooze is available for devices that are
still offline.

The label is "Snoozed" rather than "Disabled" because the state auto-clears when
the device returns, which "snooze" signals better than "disable".

## Motivation

Offline devices (e.g. decommissioned hardware, a switch that's powered down) clutter
the Topology and Metrics views and can keep generating anomaly notifications. Users
want a clean way to make an offline device disappear and go quiet, without it being
gone for good — when the device comes back, it should return on its own.

## Behavior

- A device can be snoozed only while it is offline. Snoozing an online device is not
  offered in the UI (and would auto-unsnooze on the next poll anyway).
- A snoozed device is:
  - hidden from the Topology device map/diagram (and any edges to it are dropped),
  - hidden from the Metrics device list,
  - excluded from metrics recording and anomaly checks (no new snapshots, no new
    notifications),
  - and has its existing active notifications resolved at the moment it is snoozed.
- A snoozed device auto-unsnoozes when it is next seen online by the background
  poller (~30s cadence). No manual action required.
- A device that is still offline can be unsnoozed manually from the Metrics module
  or the Settings pane.
- Snooze state persists across restarts and is keyed by MAC (stable across reboots
  and device renames).
- A device permanently removed from the controller simply stays snoozed; it is out
  of the way and can be unsnoozed manually if desired.

"Online" for reconnect detection means the device is present in the current poll's
live device stats (the same signal Metrics uses to mark a device `online`).

## Approach

Server-side "snoozed devices" set, mirroring the existing `zone_filter` /
`HiddenZoneRow` pattern. This is the only approach that satisfies the
"suppress alerts/processing" requirement, because suppression and reconnect
detection happen in the backend poller. Rejected alternatives:

- Client-side only (localStorage filter): cannot stop server-side anomaly
  notifications, and does not persist across browsers.
- Generalizing `zone_filter` into a shared "hidden entities" store: YAGNI —
  zones do not auto-re-enable; devices do. Coupling them adds complexity for no
  gain.

## Data model

New table `snoozed_devices`, represented by `SnoozedDeviceRow` in `models_db.py`:

| Column       | Type | Notes                                                        |
|--------------|------|--------------------------------------------------------------|
| `mac`        | Text | Primary key. Stable device identifier.                       |
| `name`       | Text | Snapshot of the device name at snooze time (manage-list UI). |
| `model`      | Text | Snapshot of the device model at snooze time.                 |
| `snoozed_at` | Text | ISO-8601 timestamp, for display and sort order.              |

`name`/`model` are snapshots because a snoozed device is hidden/offline, so no live
data is available to render the manage list.

The table is created through the project's existing schema path (Alembic migration
plus `create_all` for tests), consistent with the other tables in `models_db.py`.

## Backend service — `app/services/snoozed_devices.py`

Mirrors `app/services/zone_filter.py` (session-per-call, structured logging).

- `get_snoozed() -> list[SnoozedDevice]` — all rows as DTOs (mac, name, model,
  snoozed_at), newest first.
- `get_snoozed_macs() -> set[str]` — fast membership set for filtering.
- `snooze_devices(devices: list[SnoozeInput]) -> None` — upsert one or many
  (covers both the per-device and bulk actions). For each newly snoozed device,
  resolve all of its active notifications (across every check type — the existing
  `resolve_notifications(mac, check_id)` is per-check, so iterate the known check
  IDs or add a resolve-all-for-MAC helper) so existing alerts clear immediately.
  Dedupe by MAC; ignore devices already snoozed (keep original `snoozed_at`).
  The service does not enforce offline-only — the UI only offers snooze for offline
  devices, and `reconcile_online` auto-clears any online device that slips through.
- `unsnooze_device(mac: str) -> None` — delete the row if present (idempotent).
- `reconcile_online(online_macs: set[str]) -> list[str]` — delete any snoozed row
  whose MAC is in `online_macs`; return the list of unsnoozed MACs (for logging).

`SnoozeInput` and `SnoozedDevice` are Pydantic models in `app/models.py`
(`SnoozeInput`: mac, name, model; `SnoozedDevice`: mac, name, model, snoozed_at).

## Backend router — `app/routers/snoozed_devices.py`

Registered under `/api` in `main.py`. App-local state, so no controller credentials
are required (the list is manageable even while the controller is unreachable).

- `GET /api/devices/snoozed` → `SnoozedDevicesResponse { devices: [SnoozedDevice] }`
- `POST /api/devices/snoozed` body `SnoozeRequest { devices: [SnoozeInput] }` →
  snooze one or many; returns the updated list.
- `DELETE /api/devices/snoozed/{mac}` → unsnooze; returns the updated list.

## Backend integration

- Topology — `get_topology_devices`: exclude snoozed MACs from the returned devices
  and drop any edge whose endpoints reference a snoozed MAC.
- Metrics — `get_latest_snapshots`: exclude snoozed MACs from the returned snapshots.
- Poller — `_poll_once`, each cycle, in this order:
  1. Compute `online_macs` = MACs present in the current poll's normalized stats.
  2. `reconcile_online(online_macs)` to auto-unsnooze reconnected devices first, so a
     just-returned device is recorded the same cycle.
  3. Filter still-snoozed MACs out of the stats before `record_snapshot` and
     `_check_anomalies`, so snoozed devices produce no snapshots or notifications.

No extra controller calls — the poller already fetches the full device list.

## Frontend

- `api/types.ts`: `SnoozedDevice { mac, name, model, snoozed_at }`.
- `api/client.ts` + `hooks/queries.ts`: `useSnoozedDevices()` (query),
  `useSnoozeDevices()` (mutation, accepts a list), `useUnsnoozeDevice()` (mutation).
  On success, invalidate the snoozed, metrics, and topology queries.
- Metrics module:
  - Offline device cards (status !== "online") get a Snooze action.
  - A header action "Snooze offline (N)" appears when offline devices exist (bulk).
  - A collapsible "Snoozed devices (N)" section at the bottom lists snoozed devices
    with an inline Unsnooze button; collapsed by default.
- Settings modal: a "Snoozed devices" pane (list + unsnooze), mirroring the Metrics
  manage section.
- Topology: no new control; snoozed devices simply do not appear (server filters).

## Testing

- Backend (hold 98% coverage):
  - `snoozed_devices` service: CRUD, dedupe, `reconcile_online`, notification
    resolution on snooze.
  - Router: GET/POST/DELETE happy paths and edge cases.
  - Topology and Metrics filtering of snoozed MACs (including edge dropping).
  - Poller: reconcile-first ordering, suppression of recording/anomaly for snoozed
    devices, auto-unsnooze on reconnect.
- Frontend (hold 95% coverage, React Doctor 100):
  - queries (snooze list, snooze mutation, unsnooze mutation, invalidations),
  - Metrics snooze button / bulk action / collapsible manage section,
  - Settings snoozed-devices pane.

## Out of scope

- Snoozing online devices.
- Snoozing via the Topology view (Topology only reflects the filtering).
- Any write action against the UniFi controller (this is app-local state only).
- A "still offline" notification/hint when a snoozed device returns (auto-unsnooze
  handles the return silently).
