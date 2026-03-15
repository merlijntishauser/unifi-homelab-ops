# Site Health AI Design

Date: 2026-03-15

## Overview

The `/health` route provides a unified site health dashboard with two sections: deterministic module summary cards at the top showing aggregated status from all three modules, and an optional AI-powered cross-domain analysis below. The view has value without AI configured. AI analysis is triggered manually to avoid surprise API costs.

## Summary Cards

Three cards rendered horizontally, one per module. Each uses existing endpoints -- no new backend work. Cards are clickable, navigating to the corresponding module.

**Firewall card** (from `GET /api/firewall/zone-pairs`):
- Zone pair count per grade (e.g. "3 A, 2 B, 1 D")
- Finding count by severity
- Uncovered zone pairs (predefined rules only, no user rules)

**Topology card** (from `GET /api/topology/devices`):
- Device count by type
- Offline devices (count or green checkmark)
- Firmware mismatches across same-model devices

**Metrics card** (from `GET /api/metrics/devices` + `GET /api/metrics/notifications`):
- Active notifications by severity
- Devices with high resource usage (CPU >80% or memory >85%)
- Recent reboots in last 24h

Each card has a colored left border based on worst status: green (healthy), yellow (warnings), red (critical). Data auto-refreshes via existing TanStack Query hooks.

## AI Analysis

### Trigger

Manual. "Analyze Site Health" button when no cached analysis exists. After first run: results displayed with "Re-analyze" button and "Last analyzed: X ago" timestamp. Consistent with how firewall AI analysis works (user-initiated, not automatic).

### Backend endpoint

`POST /api/health/analyze` -- single endpoint that internally gathers context from all three modules, assembles the prompt, calls the AI provider, and returns findings.

### Context assembly

Three structured blocks gathered server-side:

**Firewall**: zone pair count, grade distribution, total findings by severity, zone pairs with no user rules, top 3 highest-severity findings with zone pair names.

**Topology**: device inventory by type, offline devices (names), single-uplink devices (single points of failure), firmware version distribution, VPN tunnel count and status.

**Metrics**: active notification summary by check type and severity, devices with sustained high CPU/memory from 24h history, PoE budget utilization across switches, recent unexpected reboots in last 24h.

### Prompt structure

System prompt sets the site profile (homelab/smb/enterprise, reusing existing `site_profile` setting). Instructs the AI to produce cross-domain findings -- issues that span multiple modules or that individual analyzers cannot detect alone. Examples:

- "IoT zone has allow-all to external but IoT devices show high outbound traffic"
- "Switch X is a single point of failure and its CPU is sustained above 80%"
- "Guest zone has no block rules to internal, and 3 unknown clients connected to the guest AP"

### Response model

```
HealthFinding:
  severity: str          # critical, high, medium, low
  title: str
  description: str
  affected_module: str   # firewall, topology, metrics
  affected_entity_id: str  # zone pair key or device MAC
  recommended_action: str
  confidence: str        # high, medium, low
```

### Caching

Results cached in a `health_analysis_cache` SQLite table. Cache key: composite hash of firewall rule content hash + device MAC list hash + latest metrics timestamp + site_profile + prompt_version. Cache checked before calling AI. "Re-analyze" button bypasses the cache.

### Error handling

- AI not configured: message explaining how to set it up in Settings
- API call failure: error message with retry button
- Malformed response: drop invalid findings, show valid ones
- Loading: spinner during analysis

## Frontend

### HealthModule

Replaces HealthPlaceholder at `/health`. Same pattern as other modules.

Layout:
- Summary cards row (responsive: stacked on mobile, 3 across on desktop)
- AI analysis section with button, loading state, results
- Results grouped by severity: critical first, then high, medium, low

Each finding card shows:
- Severity badge (colored dot + label)
- Title (bold)
- Description
- Affected module badge ("Firewall" / "Topology" / "Metrics")
- Recommended action (dimmed block)
- Confidence indicator

### Finding click-through

Clicking a finding pushes browser history and navigates to the relevant module:
- Firewall findings: `/firewall` with zone graph focused on the affected zone pair
- Topology findings: `/topology` map view with the affected device selected
- Metrics findings: `/metrics` detail view for the affected device

Browser back returns to `/health` with scroll position preserved.

### Data hooks

- Summary data: `useZonePairs`, `useTopologyDevices`, `useMetricsDevices`, `useNotifications` (existing hooks)
- AI analysis: `useHealthAnalysis` mutation calling `POST /api/health/analyze`
- Cached result returned with `cached: boolean` and `analyzed_at: string` fields

No toolbar controls -- "Analyze" / "Re-analyze" button is inline.

## Implementation order

1. Backend: health service (context assembly from existing services)
2. Backend: health router with `/api/health/analyze` endpoint
3. Backend: caching in SQLite (Alembic migration)
4. Frontend: API types, client method, mutation hook
5. Frontend: summary cards (HealthSummaryCard component)
6. Frontend: HealthModule with AI section and finding cards
7. Frontend: click-through navigation to other modules
8. Tests for all layers
