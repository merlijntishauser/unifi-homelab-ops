# UniFi Firewall Analyser -- Design Document

## Problem

UniFi Network 9.x+ uses a zone-based firewall model with inter-zone policies. As the number of zones and rules grows, it becomes difficult to maintain a clear mental model of what traffic is allowed, blocked, or missing coverage. There is no built-in tool to visualize the full rule landscape or verify traffic flow across zones.

## Solution

A web-based tool that renders all firewall zones and rules as an interactive node graph. Zones are nodes, rules are edges. Clicking an edge reveals the ordered rule list and a packet simulation form that shows which rule would match and the final verdict.

## Architecture

```
Browser (React + React Flow)
        |
   REST API (FastAPI)
        |
   unifi-topology (Python lib)
        |
   UniFi Controller API
```

### Backend (FastAPI)

Uses `unifi-topology` to connect to the UniFi controller and fetch firewall data. Exposes a REST API consumed by the frontend.

**Authentication with the controller:**
- Environment variables as defaults: `UNIFI_HOST`, `UNIFI_USERNAME`, `UNIFI_PASSWORD`, `UNIFI_VERIFY_SSL` (default: `false`)
- Login screen in the UI to override credentials at runtime (stored in backend session)

**Endpoints:**
- `GET /api/zones` -- all zones with associated networks, VLANs, subnets
- `GET /api/rules` -- all firewall rules, optionally filtered by zone pair
- `POST /api/simulate` -- packet simulation: accepts `{src_ip, dst_ip, protocol, port}`, returns rule evaluation chain and verdict

### Frontend (React + React Flow + Tailwind CSS)

**Zone Graph (main view):**
- Zone nodes: styled cards with name, type icon, color coding by type (WAN, LAN, Guest, VPN, DMZ, Custom), badge showing associated network count. Click to expand and show networks/VLANs/subnets.
- Rule edges: color-coded by posture (green = mostly allow, red = mostly block, amber = mixed), animated dashes for default-deny pairs with no explicit rules. Label or thickness indicates rule count.
- Auto-layout (force-directed or layered) with WAN at the periphery and internal zones grouped centrally. Drag to rearrange.

**Rule Side Panel (on edge click):**
- Priority-ordered list of rules for the selected zone pair
- Each rule shows: action icon, name, protocol/port, enabled/disabled state
- "Test Packet" mini-form: source IP, destination IP, protocol, port
- Simulation result highlighted inline: matched rule, final verdict (allow/block)
- Disabled rules shown grayed out with "would have matched" indicator

**Toolbar:**
- Refresh data from controller
- Toggle disabled rules visibility
- Filter by zone type
- Dark/light theme toggle

### Data Model

**Zone (graph node):**
- `id`, `name`, `type` (LAN, WAN, Guest, VPN, DMZ, Custom)
- `networks`: list of associated networks with VLAN ID, subnet
- Color/icon derived from type

**Firewall Rule (graph edge component):**
- `id`, `name`, `description`
- `source_zone` -> `destination_zone`
- `action`: allow | block | reject
- `protocol`, `port_group`, `ip_group`
- `enabled`: boolean
- `index`: priority/ordering

**Zone Pair (aggregated edge):**
- All rules between zone A and zone B, ordered by priority
- Summary: allow count, block count
- Default policy when no rule matches

### Packet Simulation Engine

`POST /api/simulate` evaluates a packet against the rule chain:

1. **Resolve zones** -- match source/destination IP against zone subnets
2. **Collect rules** -- gather rules for the zone pair, sorted by index
3. **Evaluate** -- iterate top-to-bottom:
   - Check protocol match (TCP/UDP/ICMP/any)
   - Check port match (single, range, group, any)
   - Check IP group match if rule has source/dest restrictions
   - Skip disabled rules (flagged in response)
4. **Verdict** -- first matching rule's action, or default policy

Response includes the full evaluation chain so the UI can show exactly why traffic is allowed or blocked.

```json
{
  "source_zone": "LAN",
  "destination_zone": "WAN",
  "rules_evaluated": [
    {"rule": "...", "matched": false, "reason": "port mismatch"},
    {"rule": "...", "matched": true, "reason": "first match"}
  ],
  "verdict": "allow",
  "matched_rule": "Allow LAN to WAN outbound",
  "default_policy_used": false
}
```

## Project Structure

```
unifi-firewall-analyser/
  docker-compose.yml          # Local dev: backend + frontend with hot-reload
  backend/
    Dockerfile
    app/
      main.py                 # FastAPI app, CORS, lifespan
      config.py               # Settings (env vars + runtime overrides)
      routers/
        auth.py               # Login/session management
        zones.py              # GET /api/zones
        rules.py              # GET /api/rules
        simulate.py           # POST /api/simulate
      services/
        firewall.py           # Fetches & normalizes zones/rules via unifi-topology
        simulator.py          # Packet simulation engine
    requirements.txt
  frontend/
    Dockerfile
    src/
      components/
        ZoneGraph.tsx          # React Flow canvas
        ZoneNode.tsx           # Custom node component
        RuleEdge.tsx           # Custom edge component
        RulePanel.tsx          # Side panel with rule list + simulation form
        LoginScreen.tsx        # Controller credentials form
        Toolbar.tsx            # Refresh, filters, theme toggle
      api/
        client.ts              # API client (fetch wrapper)
      App.tsx
    package.json
```

## Tech Stack

**Backend:** Python 3.12+, FastAPI, uvicorn, unifi-topology, pydantic
**Frontend:** React, React Flow, Tailwind CSS, Vite
**Dev infra:** Docker Compose (backend on :8000, frontend on :5173 with proxy)
**Production:** FastAPI serves built React app as static files

## Changes to unifi-topology

The library needs a new firewall adapter that fetches:
- Zone definitions from the UniFi controller API
- Firewall rules and their zone assignments
- Zone-pair default policies
- Network/VLAN to zone mappings

This keeps the data fetching logic reusable and separate from the web tool.
