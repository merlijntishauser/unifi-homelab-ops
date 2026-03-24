# Cabling Module Design

**Date:** 2026-03-24
**Status:** Approved

## Goal

Document physical cable runs and patch panel assignments. Pre-populated from LLDP topology edges, user adds physical details (cable type, length, color, labels). Cross-links with Rack Planner and Topology Module.

## Data Model

### Cable Run

One record per physical end-to-end connection.

| Field | Type | Source | Description |
|---|---|---|---|
| id | int PK | auto | |
| source_device_mac | text nullable | LLDP | Links to topology device |
| source_port | int nullable | LLDP | Port index on source device |
| dest_device_mac | text nullable | LLDP | Links to topology device |
| dest_port | int nullable | LLDP | Port index on dest device |
| dest_label | text | user | Free text for non-device endpoints ("Office 201-A") |
| patch_panel_id | int FK nullable | user | Patch panel this cable routes through |
| patch_panel_port | int nullable | user | Port number on the panel |
| cable_type | text | auto/user | cat5e, cat6, cat6a, fiber-om3, fiber-os2, dac |
| length_m | float nullable | user | Cable length in meters |
| color | text | user | Cable color |
| label | text | auto/user | Cable ID (e.g., "C-001") |
| speed | int nullable | LLDP | Link speed in Mbps |
| poe | bool | LLDP | PoE active |
| status | text | auto/user | active, spare, faulty, disconnected |
| notes | text | user | |

### Patch Panel

Patch panels can be rack-mounted or standalone (wall-mounted, cabinet, etc.).

| Field | Type | Description |
|---|---|---|
| id | int PK | |
| name | text | e.g., "PP-01 Meterkast" |
| port_count | int | 12, 24, 48 |
| panel_type | text | keystone, fixed, fiber |
| rack_mounted | bool | |
| rack_item_id | int FK nullable | Links to RackItem when rack-mounted |
| location | text | Free text for non-rack panels |
| notes | text | |

Port assignments are derived from CableRun records referencing the panel (no separate port table).

### Cable Label Scheme (settings)

| Field | Type | Description |
|---|---|---|
| mode | text | sequential, location, custom |
| prefix | text | e.g., "C-" |
| next_number | int | Auto-increment counter |
| custom_pattern | text nullable | For custom mode |

## LLDP Sync Logic

Triggered by user via "Sync from Topology" button.

**Auto-populated fields:**
- source_device_mac, source_port, dest_device_mac, dest_port (from LLDP edges)
- speed, poe (from port data)
- cable_type: cat6 for <=2500 Mbps, fiber-om3 for 10G+, dac heuristic
- status: active
- label: auto-generated from configured scheme

**Not auto-populated:** length, color, patch panel, dest_label (wall jacks)

**Subsequent sync behavior:**
- Match by source_device_mac + source_port
- Update speed/poe if changed
- Add new cables for new connections
- Mark disappeared connections as "disconnected" (don't delete)
- Never overwrite user-entered fields

**Skipped:** Wireless connections (wireless: true edges)

## UI Layout

New sidebar module: "Cabling"

### Cable Table (default view)

Filterable, sortable table. Columns: Label, Source, Destination, Via (patch panel), Type, Length, Speed, Status.

Clicking a row opens edit side panel (Rack Planner pattern). Filter bar: by device, patch panel, status, cable type.

Toolbar: "Sync from Topology" button, "Add Cable" button.

### Patch Panels view

Card grid (Rack overview pattern). Each card: name, port utilization (e.g., "18/24"), location/rack, type badge.

Clicking a card opens port map: visual grid showing front (device/port) and back (destination) per port.

### Diagram view (future, not v1)

Sankey-style cable path visualization. Deferred.

## Cross-linking

### From Topology Module
- DevicePanel gets a "Cables" section below the port table
- Cable labels link to Cabling module

### From Rack Planner
- Patch panel rack items show port utilization badge
- Clicking links to Cabling module patch panel view

### From Cabling Module
- Device names link to Topology (device selected)
- Patch panel names link to Patch Panels view
- Rack-mounted panels show rack name linking to Rack Planner

## API Endpoints

```
GET    /api/cables                  -- list all cable runs (filterable)
POST   /api/cables                  -- create cable run
PUT    /api/cables/{id}             -- update cable run
DELETE /api/cables/{id}             -- delete cable run
POST   /api/cables/sync             -- sync from LLDP topology

GET    /api/patch-panels            -- list all patch panels
POST   /api/patch-panels            -- create patch panel
PUT    /api/patch-panels/{id}       -- update patch panel
DELETE /api/patch-panels/{id}       -- delete patch panel

GET    /api/settings/cable-labels   -- get label scheme
PUT    /api/settings/cable-labels   -- update label scheme
```

## Database

Two new SQLite tables via Alembic migration. Cable label scheme stored as single-row settings (same pattern as AI analysis settings).

## Backend Services

- `cable_service.py` -- CRUD for cables and patch panels, LLDP sync logic
- Sync takes topology data as input (same fetch pattern as rack planner)
- No background poller -- sync is user-triggered

## Testing

- Backend: service tests with SQLite, router tests with patched service. Target 100%.
- Frontend: unit tests with mocked API. Target 95%+ branches.
- E2e: basic navigation and CRUD flow.

## Non-goals

- Cable inventory / stock tracking
- Automatic cable path diagram (v1)
- Cable cost estimation
