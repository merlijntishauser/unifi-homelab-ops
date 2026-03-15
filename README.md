# UniFi Homelab Ops

A self-hosted web application that extends the native UniFi dashboard with firewall analysis, network topology visualization, device metrics monitoring, and AI-powered site health assessment. Connect to your controller and get deeper visibility into your UniFi network.

## Modules

### Firewall

- **Zone matrix** -- overview of all zone-to-zone rule relationships at a glance
- **Interactive graph** -- click a cell to explore zones and rules as a node graph with automatic layout
- **Rule inspector** -- expand any rule to see match criteria, protocol, metadata, and static analysis findings
- **Traffic simulator** -- enter source/destination IP, protocol, and port to trace which rule matches
- **Static analysis** -- automatic scoring with 11 security checks per zone pair (A-F grading)
- **AI analysis** -- optional deep analysis via OpenAI or Anthropic with caching and site profile context
- **Rule management** -- enable/disable rules and reorder rule priority directly from the UI

### Topology

- **Interactive device map** -- ReactFlow graph showing device connections, port status, and LLDP neighbors
- **SVG diagram** -- orthogonal or isometric network topology with pan, zoom, and export (SVG/PNG)
- **Device panel** -- port table, firmware version, client count, uptime per device

### Metrics

- **Device monitoring** -- CPU, memory, temperature, traffic, PoE consumption for all UniFi devices
- **Sparkline grid** -- at-a-glance device cards with 24h trends, auto-refreshing every 30 seconds
- **Detail view** -- per-device time-series charts with notification history
- **Anomaly detection** -- automatic alerts for high CPU, memory, temperature, PoE overload, and unexpected reboots
- **Notification system** -- severity-based alerts with dismissal and auto-resolution

### Site Health

- **Summary dashboard** -- aggregated status cards from all three modules with colored health indicators
- **AI cross-domain analysis** -- correlates firewall posture, topology risks, and metric anomalies to find issues no single module can detect
- **Finding cards** -- severity-grouped results with module badges, recommended actions, and click-through navigation to the affected entity

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- A UniFi Network controller running 9.x or later

### Quick start

```bash
docker run -d \
  --name unifi-homelab-ops \
  -p 8080:8080 \
  -v unifi-homelab-ops-data:/data \
  merlijntishauser/unifi-homelab-ops:latest
```

Open [http://localhost:8080](http://localhost:8080) and log in with your UniFi controller credentials.

### With environment credentials

```bash
docker run -d \
  --name unifi-homelab-ops \
  -p 8080:8080 \
  -v unifi-homelab-ops-data:/data \
  -e UNIFI_URL=https://192.168.1.1 \
  -e UNIFI_SITE=default \
  -e UNIFI_USER=admin \
  -e UNIFI_PASS=yourpassword \
  -e UNIFI_VERIFY_SSL=false \
  merlijntishauser/unifi-homelab-ops:latest
```

Notes:

- All `UNIFI_*` variables are optional. If omitted, log in through the UI after startup.
- Runtime UI credentials take priority over environment variables until the container restarts.
- Mount `/data` to persist settings, cached analysis results, and metrics history.
- An Alpine variant is available: `merlijntishauser/unifi-homelab-ops:alpine`

### Development

```bash
git clone https://github.com/merlijntishauser/unifi-homelab-ops.git
cd unifi-homelab-ops
cp .env.example .env     # edit with your controller credentials
make build && make up    # API on :8001, frontend on :5174
```

Both services mount source code as volumes -- changes reflect immediately via Vite HMR and uvicorn reload.

```bash
make down                # stop
make ci                  # full local CI pipeline (lint, type check, test, complexity)
make e2e                 # Playwright e2e tests (dev)
make e2e-prod            # Playwright e2e tests (production Docker image)
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `UNIFI_URL` | Controller URL | -- |
| `UNIFI_SITE` | Site name | `default` |
| `UNIFI_USER` | Controller username | -- |
| `UNIFI_PASS` | Controller password | -- |
| `UNIFI_VERIFY_SSL` | Verify SSL certificates | `false` |
| `APP_PASSWORD` | Application passphrase gate (optional) | -- |
| `APP_SESSION_TTL` | Session duration in seconds | `86400` |
| `HOMELAB_OPS_DB_PATH` | SQLite database path | `/data/homelab-ops.db` |
| `LOG_LEVEL` | Server log level | `INFO` |

### AI analysis (optional)

AI-powered analysis can be configured via the Settings modal in the app, or via environment variables:

| Variable | Description | Default |
|---|---|---|
| `AI_BASE_URL` | Provider API base URL | -- |
| `AI_API_KEY` | API key | -- |
| `AI_API_KEY_FILE` | Path to file containing the API key | -- |
| `AI_MODEL` | Model name (e.g. `gpt-4o`, `claude-sonnet-4-6`) | -- |
| `AI_PROVIDER_TYPE` | `openai` or `anthropic` | `openai` |

Supports any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.) and the Anthropic API.

## Docker images

Published to [Docker Hub](https://hub.docker.com/r/merlijntishauser/unifi-homelab-ops) on every push to `main` and on version tags.

| Tag | Description |
|---|---|
| `latest` | Latest release or main branch build |
| `1.0.0`, `1.0`, `1` | Pinned release version |
| `main` | Latest main branch build |
| `sha-abc123` | Specific commit |
| `alpine` | Alpine variant of latest |
| `1.0.0-alpine` | Alpine variant of pinned release |

Multi-arch: `linux/amd64` and `linux/arm64`.

CI also builds both image variants, runs smoke tests, and scans with Trivy for HIGH/CRITICAL vulnerabilities.

## Releasing

```bash
# 1. Add a dated section to CHANGELOG.md
# 2. Run:
make release VERSION=1.1.0
```

This validates the changelog, bumps version in `pyproject.toml` and `package.json`, commits, creates a signed tag, and pushes. GitHub Actions then builds Docker images and creates a GitHub Release.

## License

[MIT](LICENSE)
