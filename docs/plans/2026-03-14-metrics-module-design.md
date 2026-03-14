# Metrics Module Design

Date: 2026-03-14

## Overview

Device health dashboard with background polling, 24-hour rolling history, sparkline visualization, passive anomaly detection, and a notification system. The third module in the UniFi Homelab Ops platform.

## Upstream: fetch_device_stats()

New function in the unifi-topology library (PR required). Calls `/api/s/{site}/stat/device` with `detailed=True` and extracts stats into a `DeviceStats` frozen dataclass:

```
DeviceStats:
  mac: str
  name: str
  model: str
  type: str
  uptime: int                     # seconds
  cpu: float                      # percentage (0-100)
  mem: float                      # percentage (0-100)
  temperature: float | None       # celsius
  tx_bytes: int
  rx_bytes: int
  num_sta: int                    # connected clients
  version: str
  poe_ports: list[PoePortStats]   # per-port PoE draw
  poe_budget: float | None        # total budget watts (switches)

PoePortStats:
  port_idx: int
  poe_power: float                # watts
  poe_mode: str
```

Bypasses the library's JSON cache (`use_cache=False`) since the poller always wants fresh data.

## Backend

### Background poller

Runs as an `asyncio` task started in FastAPI's lifespan. Polls every 30 seconds. On each tick:

1. Call `fetch_device_stats(config, site, use_cache=False)`
2. Write one row per device to `device_metrics`
3. Run anomaly checks against each snapshot
4. Create or resolve notifications based on check results
5. Log a summary

Only runs when credentials are configured. Pauses on logout, resumes on login. Catches all exceptions to avoid crashing the app -- logs errors and retries on the next tick.

### SQLite tables (Alembic migration)

**device_metrics**: `id` (auto), `mac` (text), `timestamp` (datetime), `cpu` (real), `mem` (real), `temperature` (real nullable), `uptime` (int), `tx_bytes` (int), `rx_bytes` (int), `num_sta` (int), `poe_consumption` (real nullable). Index on `(mac, timestamp)`.

**notifications**: `id` (auto), `device_mac` (text), `check_id` (text), `severity` (text), `title` (text), `message` (text), `created_at` (datetime), `resolved_at` (datetime nullable), `dismissed` (bool default false). Index on `(resolved_at, dismissed)`.

Daily prune job deletes metrics older than 24 hours and resolved notifications older than 24 hours.

### API endpoints

- `GET /api/metrics/devices` -- latest snapshot per device (grid overview)
- `GET /api/metrics/devices/{mac}/history` -- 24h history for one device (sparklines)
- `GET /api/metrics/notifications` -- active and recent notifications
- `POST /api/metrics/notifications/{id}/dismiss` -- mark as read

### Anomaly checks

Hardcoded thresholds (configurable later):

| Check | Condition | Severity |
|-------|-----------|----------|
| Device offline | No stats for 2 consecutive polls (60s) | critical |
| High CPU | > 80% sustained for 5 min (10 polls) | warning |
| High memory | > 85% | warning |
| High temperature | > 80C warning, > 95C critical | warning/critical |
| PoE overload | Budget > 90% utilization | warning |
| Unexpected reboot | Uptime decreased since last snapshot | critical |
| Firmware mismatch | Version differs from majority of same model | warning |

Each check has a `check_id`. Notifications auto-resolve when the condition clears (`resolved_at` is set). The notification drawer shows active (unresolved) and recent (resolved within 24h).

### Notification model

Each notification has: severity (warning/critical), device reference, timestamp, message, and resolved flag. No email, Slack, or webhook push -- this is a local dashboard, not an alerting platform.

## Frontend

### Metrics module

Same pattern as FirewallModule and TopologyModule. Local toolbar, content area below.

**Grid overview** (default): Responsive card grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`). Each `DeviceMetricCard` shows:

- Device name, model, status dot
- CPU bar + sparkline (24h)
- Memory bar + sparkline (24h)
- Temperature with color coding (green/yellow/red)
- Client count
- Uptime formatted

Sparklines are inline SVG `<polyline>` elements (~80px wide). No axes, no labels -- just the trend shape. Color follows the metric state.

**Device detail view**: Click a card, "Back to overview" button. Shows:

- Device header (name, model, IP, firmware, uptime)
- Larger sparkline charts (full width, ~80px tall) for CPU, memory, temperature, traffic
- PoE port table with consumption data
- Active notifications for this device

**Data hooks**: `useMetricsDevices()` and `useMetricsHistory(mac)` auto-refetch every 30s (`refetchInterval: 30000`).

### Notification drawer

Bell icon in sidebar bottom section (between Settings and collapse toggle). Badge shows undismissed count.

Click opens a ~320px drawer sliding from the left:

- Header with count and "Dismiss all" button
- Notification cards: severity dot, title, message, device name, relative timestamp
- Resolved notifications shown dimmed
- Click navigates to device in metrics detail view
- Empty state: "No notifications"

Unread count available via `useNotifications()` hook that runs regardless of active module (for the sidebar badge).

## Implementation order

1. Upstream PR: `fetch_device_stats()` in unifi-topology
2. Backend: Alembic migration for tables
3. Backend: Metrics service + poller task
4. Backend: Anomaly checker
5. Backend: Metrics router + notification endpoints
6. Frontend: API types, client, hooks
7. Frontend: Sparkline component
8. Frontend: DeviceMetricCard + MetricsModule (grid + detail)
9. Frontend: Notification drawer + sidebar badge
10. Tests for all layers

## Future improvements

### Sparkline chart libraries

The initial implementation uses custom inline SVG for sparklines. If richer interactivity is needed later:

- **Recharts** (~150KB): Full-featured React charting with tooltips, axes, responsive sizing. Good for interactive hover-to-inspect on charts.
- **@visx/shape + @visx/scale** (~40KB): D3-based React primitives. Middle ground -- adds axes and tooltips without full Recharts weight.

### Configurable thresholds

Anomaly check thresholds are hardcoded initially. A future settings pane could expose per-check threshold configuration stored in SQLite.

### Extended retention

24-hour rolling history is sufficient for real-time monitoring. Users wanting longer retention should use UnPoller + Grafana. A future option could extend to 7-day or 30-day retention with downsampled data points.
