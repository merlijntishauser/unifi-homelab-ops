---
name: verifier-webapp
description: >-
  Runtime-verify changes to the UniFi Homelab Ops web app by driving the real
  UI (and its HTTP API) against the running dev stack. Use when verifying a
  frontend/backend change end-to-end — snooze, topology, metrics, firewall,
  auth, etc. Surface is the browser at http://localhost:5174 via Playwright MCP;
  the backend API is reachable from the authenticated browser session.
---

# Verifier: UniFi Homelab Ops web app

Evidence-capture protocol for runtime verification of this app. The app is a
React (Vite) frontend + FastAPI backend, both in Docker Compose. Verification
means: drive the running app at its surface and capture what you observe — not
run tests.

## 1. Get a handle (launch / confirm running)

The dev stack is usually already up. Confirm:

```bash
docker compose ps --format '{{.Service}}: {{.Status}} {{.Ports}}'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/api/health   # expect 200
```

- **api** → `0.0.0.0:8001->8000` (FastAPI; `/api/...`)
- **frontend** → `0.0.0.0:5174->5173` (Vite; the UI)

Not running: `make build && make up` (first run) or `make up`. Source is volume-
mounted with hot reload (Vite HMR + uvicorn `--reload`), so code changes are
live without a rebuild. A new Alembic migration or `main.py` change triggers a
uvicorn reload that re-runs migrations — if a brand-new table seems missing,
`docker compose restart api` to force a clean lifespan.

## 2. Two gates before the app is usable

1. **App passphrase gate** (`APP_PASSWORD` in `.env`). Every `/api/*` call and
   the UI itself are gated; unauthenticated API calls return
   `401 {"detail":"Authentication required"}`. The UI shows a "Enter the
   application password" screen first. The dev password lives in `.env`
   (`APP_PASSWORD`); ask the user if it's not readable. Enter it in the UI to
   get a session cookie — after that, `fetch('/api/...')` from the page works.
2. **Controller connection.** Real devices/topology/metrics require a UniFi
   controller. The dev `.env` points at a real controller
   (`UNIFI_URL=https://192.168.1.1`) via `UNIFI_API_KEY` (env source). When
   connected, the Toolbar "Controller" badge is green ("As: API key, Config
   from: env"). Without a controller, device-dependent views are empty/401 and
   only app-local features (e.g. the snoozed-devices list) are observable.

## 3. Drive the surface (Playwright MCP)

Load the `mcp__plugin_playwright_playwright__browser_*` tools. Then:

```
browser_navigate  http://localhost:5174
browser_snapshot                      # accessibility tree (preferred over screenshot for actions)
# passphrase screen -> type password into the Password textbox, click "Unlock"
# you land on /health (AppShell). Sidebar nav: Health, Metrics, Topology, Firewall, ...
```

Capture evidence with `browser_take_screenshot` (saved under `.playwright-mcp/`)
and `browser_snapshot` (accessibility YAML). The screenshot is the one frame a
reviewer looks at; the snapshot is how you find refs to click.

### Reaching the backend API from the page

The authenticated browser session can hit the API directly — use this to read
ground-truth state behind the UI:

```
browser_evaluate  async () => (await fetch('/api/metrics/devices')).json()
browser_evaluate  async () => (await fetch('/api/topology/devices')).json()
browser_evaluate  async () => (await fetch('/api/devices/snoozed')).json()
```

(Plain `curl localhost:8001/api/...` returns 401 — it has no session cookie. Use
the page's `fetch` instead, or extract the cookie.)

## 4. Feature surfaces map

| Change area | Where to drive it |
|---|---|
| Snoozed devices | Metrics module: per-card "Snooze" on offline cards, header "Snooze offline (N)" bulk, collapsible "Snoozed devices (N)" manage section; Settings → "Snoozed" pane. Cross-effects: Topology/Health exclude snoozed; `GET/POST/DELETE /api/devices/snoozed`. |
| Metrics | `/metrics` device cards; `GET /api/metrics/devices` |
| Topology | `/topology` map + SVG; `GET /api/topology/devices`, `GET /api/topology/svg` |
| Firewall | `/firewall` zone matrix/graph; `/api/firewall/*` |
| Auth (controller) | Toolbar Controller badge; Settings → Connection pane; `/api/auth/status` (`controller_status`) |
| Health | `/health` System Summary (cross-domain counts) |

## 5. Probe, don't just confirm

After the happy path, push on the change at the same surface. Useful probes for
device-status features specifically:

- **Offline detection caveat (known sharp edge):** the Metrics API derives
  `status` from *presence in the live device-stats poll*, NOT the controller
  `state` field. An adopted-but-powered-down device is still in the poll and
  reports `status: "online"` with `uptime: 0, cpu: 0, mem: 0` — while
  `GET /api/topology/devices` reports the SAME device `status: "offline"` (it
  uses `state`). So Metrics-status-based offline logic (e.g. the snooze button
  gate) MISSES adopted-but-offline devices and only catches devices that drop
  out of the poll entirely (`status: "unknown"`). Always cross-check a device's
  status in both `/api/metrics/devices` and `/api/topology/devices` before
  concluding an offline-handling feature works. (Found during the snooze verify;
  "Switch Zijkamer" was the example.)
- State/persistence: do the action twice; reload the page; confirm via the API
  that DB state matches the UI.
- Clean up after yourself: snooze/unsnooze, etc. leave persistent state — undo
  test mutations (a poll-absent device won't auto-unsnooze, so unsnooze it
  manually) so you don't leave the user's app dirty.

## 6. Report

Use the standard verify report (Verdict / Claim / Method / Steps with
✅/❌/⚠️/🔍 + evidence paths / Findings). Lead findings with ⚠️ for anything
worth interrupting the reviewer. A bare green run with no 🔍 probe is only half
the job.
