# Contributing

## Development Setup

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

## Architecture

```
backend/               Python 3.13, FastAPI, Pydantic
  app/
    main.py            FastAPI app with lifespan, CORS, error handler
    config.py          pydantic-settings + runtime credential management
    models.py          Pydantic models (Zone, Rule, ZonePair, Finding, etc.)
    database.py        SQLite for AI config and analysis cache
    routers/           One module per domain:
      auth.py            /api/auth -- login, logout, status
      zones.py           /api/firewall/zones
      rules.py           /api/firewall/rules, /api/firewall/zone-pairs
      simulate.py        /api/firewall/simulate
      analyze.py         /api/firewall/analyze
      settings.py        /api/settings/ai
      topology.py        /api/topology
      metrics.py         /api/metrics
      health.py          /api/health
      documentation.py   /api/docs
      rack_planner.py    /api/racks
    services/          Business logic (pure functions, no framework coupling)

frontend/              React 19, TypeScript, Tailwind CSS 4, Vite
  src/
    App.tsx            Root: auth flow, state management
    api/
      types.ts           Interfaces mirroring backend models
      client.ts          API client (fetchJson helper, all endpoints)
    components/          UI components (default exports, colocated tests)
    hooks/               Custom hooks and queries
    utils/               Pure utility functions
```

## Quality Standards

### Thresholds (enforced by CI)

| Metric | Threshold |
|---|---|
| Python test coverage | 98% |
| TypeScript test coverage | 95% |
| Cyclomatic complexity | max 15 |
| Maintainability index | grade A |
| mypy | strict |

### Commands

```bash
make ci                   # full pipeline (lint + type check + test + complexity)
make quality              # linters only (ruff, mypy, tsc, eslint)
make test                 # tests only (pytest, vitest with coverage)
make complexity           # radon + eslint complexity checks
```

Or via Docker directly:

```bash
docker compose exec api uv run pytest
docker compose exec api uv run mypy app/
docker compose exec frontend npx vitest run
docker compose exec frontend npx tsc --noEmit
```

### Workflow after every change

1. Write or update unit tests for new/changed functions
2. Run tests and verify they pass
3. Run type checks (mypy + tsc)
4. After refactoring, run `make complexity` and `make quality`

## Code Conventions

### Python

- **Formatting/linting**: Ruff (line length 120, target py313)
- **Types**: mypy strict mode -- no untyped defs, no `type: ignore` without justification
- **Models**: Pydantic BaseModel in `models.py`, dataclasses for internal DTOs in services
- **Routers**: one file per domain, all under `/api` prefix, use `RequireCredentials` dependency
- **Services**: pure functions, no framework coupling, testable in isolation
- **Tests**: `tests/` directory, class-based (`class TestXxx`), fixtures in `conftest.py`

### TypeScript

- **Strict mode**: no unused locals/parameters, no any
- **ESLint**: max complexity 15 per function
- **Components**: default exports, props interface at top of file
- **Tests**: colocated (`Component.test.tsx`), mock external deps via `vi.mock()`
- **API types**: interfaces in `api/types.ts` mirror backend models exactly
- **Hooks**: custom hooks in `hooks/` directory
- **Utilities**: pure functions in `utils/`

### Styling

- **Tailwind-first** with custom theme tokens defined in `index.css` via `@theme`
- **Dark theme tokens**: `noc-bg`, `noc-surface`, `noc-raised`, `noc-input`, `noc-border`, `noc-text`, `noc-text-secondary`, `noc-text-dim`
- **Light theme tokens**: `ui-bg`, `ui-surface`, `ui-raised`, `ui-input`, `ui-border`, `ui-text`, `ui-text-secondary`, `ui-text-dim`
- **Pattern**: light fallback + dark override, e.g. `bg-gray-50 dark:bg-noc-bg`

### Commits

- Concise messages, no emoji, no Co-Authored-By lines
- Pre-commit hook runs the full CI pipeline
- All commits must be signed

## Design Decisions

- **Dual credential sources**: environment variables for non-interactive deploys, runtime login for interactive use. Runtime takes priority.
- **Credential validation on login**: `/api/auth/login` validates against the controller before storing, so bad credentials never appear as "configured".
- **Static + AI analysis**: static analysis runs on all zone pairs automatically. AI analysis is opt-in, requires API key, and results are cached by prompt content hash.
- **Blocking I/O off the event loop**: all controller and AI HTTP calls are wrapped in `asyncio.to_thread()` to keep the event loop responsive.
- **Zone pairs for all combinations**: the firewall module generates the Cartesian product of all zones, so truly uncovered paths (no rules at all) are visible.

## Releasing

```bash
# 1. Add a dated section to CHANGELOG.md
# 2. Run:
make release VERSION=1.1.0
```

This validates the changelog, bumps version in `pyproject.toml` and `package.json`, commits, creates a signed tag, and pushes. GitHub Actions then builds Docker images and creates a GitHub Release.

## Docker Images

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
