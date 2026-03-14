# Agent Guidelines

## Project overview

UniFi Homelab Ops -- a self-hosted web application that extends the native UniFi dashboard with firewall analysis, network topology visualization, and device metrics monitoring. Users connect to a UniFi controller, see zones in a matrix or interactive graph, inspect rules, simulate traffic, and optionally get AI-powered risk analysis.

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
      zones.py           /api/zones -- list zones
      rules.py           /api/rules, /api/zone-pairs -- rules and analyzed pairs
      simulate.py        /api/simulate -- traffic simulation
      analyze.py         /api/analyze -- AI analysis
      settings.py        /api/settings/ai -- AI provider configuration
    services/          Business logic:
      firewall.py        Fetches data via unifi-topology library
      analyzer.py        Static rule analysis (scoring, grading, findings)
      ai_analyzer.py     AI-powered analysis (Anthropic/OpenAI, cached)
      ai_settings.py     AI config persistence
      simulator.py       Traffic simulation with rule matching

frontend/              React 19, TypeScript, Tailwind CSS 4, Vite
  src/
    App.tsx            Root: auth flow, matrix/graph toggle, state management
    api/
      types.ts           Interfaces mirroring backend models
      client.ts          API client (fetchJson helper, all endpoints)
    components/
      LoginScreen.tsx    Controller credentials form
      Toolbar.tsx        Top bar: theme, disabled rules toggle, refresh, settings
      ZoneMatrix.tsx     Grid overview of all zone-to-zone pairs
      MatrixCell.tsx     Single cell with rule count and grade
      ZoneGraph.tsx      ReactFlow graph with zones as nodes, rules as edges
      ZoneNode.tsx       Custom ReactFlow node (zone name, networks, VLANs)
      RuleEdge.tsx       Custom ReactFlow edge (rule badges, step paths)
      RulePanel.tsx      Side panel: rules, findings, traffic simulation
      SettingsModal.tsx  AI provider configuration
    hooks/
      useFirewallData.ts Fetches zones + zone pairs, manages loading state
    utils/
      layout.ts          Dagre graph layout + edge offset computation
      edgeColor.ts       Edge color by allow/block ratio
```

## Tech stack

| Layer    | Key dependencies                                                |
|----------|-----------------------------------------------------------------|
| Backend  | FastAPI 0.115, Pydantic 2.10, unifi-topology, SQLite           |
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4, @xyflow/react 12.10 |
| Layout   | @dagrejs/dagre 2.0                                             |
| Infra    | Docker Compose, Vite 7, uv (Python), npm                       |

## Running the app

```bash
make build && make up     # api on :8001, frontend on :5174
make down                 # stop
```

Both services mount source code as volumes -- changes reflect immediately via Vite HMR and uvicorn reload.

## Quality standards

### Thresholds (enforced by CI)

| Metric                   | Threshold |
|--------------------------|-----------|
| Python test coverage     | 98%       |
| TypeScript test coverage | 95%       |
| Cyclomatic complexity    | max 15    |
| Maintainability index    | grade A   |
| mypy                     | strict    |

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
4. After refactoring, run `make complexity` and `make quality` -- degradation in coverage or quality is unacceptable

## Code conventions

### Python

- **Formatting/linting**: Ruff (line length 120, target py313)
- **Types**: mypy strict mode -- no untyped defs, no `type: ignore` without justification
- **Models**: Pydantic BaseModel in `models.py`, dataclasses for internal DTOs in services
- **Routers**: one file per domain, all under `/api` prefix
- **Services**: pure functions, no framework coupling, testable in isolation
- **Private functions**: prefixed with `_`
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
- **Accent tokens**: `ub-blue`, `ub-blue-light`, `ub-blue-dim`, `ub-purple`
- **Status tokens**: `status-success`, `status-warning`, `status-danger` (each with `-dim` variant)
- **Fonts**: Lexend (display), Outfit (body), IBM Plex Mono (mono)
- **Pattern**: light fallback + dark override, e.g. `bg-gray-50 dark:bg-noc-bg`

### Commits

- Concise messages, no emoji, no Co-Authored-By lines
- Pre-commit hook runs the full CI pipeline

## Design decisions

- **Dual credential sources**: environment variables for non-interactive deploys, runtime login for interactive use. Runtime takes priority.
- **Static + AI analysis**: static analysis runs on all zone pairs automatically. AI analysis is opt-in, requires API key, and results are cached by rule content hash.
- **Custom edge paths**: `RuleEdge.tsx` uses a custom `buildStepPath` function (not ReactFlow's `getSmoothStepPath`) to explicitly control horizontal segment y-positions for parallel routing.
- **Dagre layout with edge fan-out**: `layout.ts` computes per-edge X offsets (source and target) plus route offsets (max of outgoing and incoming index) so edges spread across node boundaries and route as parallel lines.
- **Zone matrix as default view**: matrix gives an at-a-glance overview. Clicking a cell or zone header navigates to the focused graph view. Browser back returns to matrix.
