# Metrics Detail Page Redesign

**Date:** 2026-03-23
**Status:** Approved

## Goal

Transform the metrics detail page from a basic chart dump into a structured monitoring view with at-a-glance health indicators, richer charts, and device context.

## Layout (top to bottom)

### 1. Header + Device Info Card

- Device name (large) + online/offline status dot + back button (right-aligned)
- Info card grid: Model, MAC, Firmware, IP, Uptime, Clients
- IP sourced from raw device dicts in the metrics router

### 2. Stat Strip

Horizontal row of mini stat cards with color-coded health indicators:

| Stat | Green | Yellow | Red | Shown when |
|---|---|---|---|---|
| CPU | <70% | 70-90% | >90% | Always |
| Memory | <85% | 85-95% | >95% | Always |
| Temperature | <60C | 60-80C | >80C | temperature available |
| Clients | (no color) | -- | -- | type "uap" or num_sta > 0 |
| PoE | <70% | 70-90% | >90% of budget | poe_budget set |

### 3. Charts Grid

2-column desktop, 1-column mobile:

- **CPU** -- AreaChart, blue, 0-100%
- **Memory** -- AreaChart, purple, 0-100%
- **Temperature** -- AreaChart, amber (conditional)
- **Traffic TX/RX** -- Stacked AreaChart, TX blue + RX teal, delta-computed from cumulative counters
- **Connected Clients** -- AreaChart, cyan (conditional: uap or num_sta > 0)
- **PoE Consumption** -- AreaChart, amber with ReferenceLine at poe_budget (conditional)

### 4. Notifications

Same as current with added relative timestamps and severity-colored left border strip.

## Backend Changes

- Add `ip: str = ""` to `MetricsSnapshot` model
- Extract IP from raw device dicts in metrics router `_fetch_live_stats`
- Pass IP lookup to `get_latest_snapshots`

## Frontend Changes

- Add `ip: string` to `MetricsSnapshot` type
- Rewrite `MetricsDetailView` with device info card, stat strip, conditional charts
- Extend `MetricsChart` to support dual-series stacked mode and `ReferenceLine`
- Compute traffic deltas in `MetricsDetailView`

## Non-goals

- Time range selection (keep 24h fixed)
- New API endpoints or database columns
- New dependencies (recharts already installed)
