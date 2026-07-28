# Agent Guidelines

## Project overview

UniFi Homelab Ops -- a self-hosted web app that augments the UniFi dashboard. Modules are routed via React Router under a shared `AppShell`:

- **Firewall** -- zones in a matrix or interactive graph, rule inspection, traffic simulation, AI risk analysis
- **Topology** -- device map (xyflow) and SVG diagram, draggable layout
- **Metrics** -- per-device CPU/mem/temp/PoE charts
- **Health** -- cross-domain anomaly analysis
- **Rack Planner** -- rack visualisation with drag-drop items and BOM
- **Cabling** -- cable runs and patch panels
- **Docs / Home Assistant** -- companion panes

## Quality standards

### Thresholds (enforced by CI)

| Metric                   | Threshold |
|--------------------------|-----------|
| Python test coverage     | 98%       |
| TypeScript test coverage | 95%       |
| Cyclomatic complexity    | max 15    |
| Maintainability index    | grade A   |
| mypy                     | strict    |
| React Doctor score       | 100 / 100 |

The pre-commit hook (`scripts/ci-checks.sh`) runs the full `make ci` pipeline
plus React Doctor and blocks the commit if any gate fails. Don't `--no-verify`;
fix the violation. Commits must also be signed (1Password SSH agent).

### Workflow after every change

1. Write or update unit tests for new/changed functions
2. Run tests and verify they pass
3. Run type checks (mypy + tsc)
4. After refactoring, run `make complexity` and `make quality` -- degradation in coverage or quality is unacceptable

## Code conventions

### Python

- **Formatting/linting**: Ruff (line length 120, target py314)
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
- **Server state**: every fetch/mutation goes through `hooks/queries.ts`. Don't call `fetch` / `api.*` from components.
- **Target**: ES2023 (uses `Array.prototype.toSorted` etc. -- prefer it over `[...arr].sort()`)

### React 19 conventions (enforced by React Doctor)

- Prefer `use(Context)` over `useContext(Context)` (React 19+)
- Use semantic `<button type="...">` / `<dialog>` over `role="button"` / `role="dialog"` divs
- Native `<button>` handles Enter/Space -- test keyboard with `@testing-library/user-event`'s `keyboard()`, not `fireEvent.keyDown` (jsdom doesn't synthesize the click)
- Memoise context Provider `value`; never inline `value={{ ... }}`
- Sync with external stores (history, custom stores) via `useSyncExternalStore`, not `useState` + `useEffect`
- Mutations that should refresh cached queries: `onSuccess: () => qc.invalidateQueries(...)`

### Styling

- **Tailwind-first** with custom theme tokens defined in `index.css` via `@theme`
- **Sizing**: collapse `w-N h-N` to `size-N` when both axes match (Tailwind 3.4+)
- **Typography**: typographic ellipsis `…` (not `...`) in JSX text
- **Dark theme tokens**: `noc-bg`, `noc-surface`, `noc-raised`, `noc-input`, `noc-border`, `noc-text`, `noc-text-secondary`, `noc-text-dim`
- **Accent tokens**: `ub-blue`, `ub-blue-light`, `ub-blue-dim`, `ub-purple`
- **Status tokens**: `status-success`, `status-warning`, `status-danger` (each with `-dim` variant)
- **Fonts**: Lexend (display), Outfit (body), IBM Plex Mono (mono)
- **Pattern**: light fallback + dark override, e.g. `bg-gray-50 dark:bg-noc-bg`

### Commits

- Concise messages, no emoji, no Co-Authored-By lines
- Pre-commit hook runs the full CI pipeline
- Signed commits required (1Password SSH agent); stop and alert if signing fails

### Dependabot PRs

- `@dependabot rebase` / `@dependabot recreate` are sometimes ignored -- wait a
  few minutes, then manually rebase: fetch the branch, merge `main`, regenerate
  `package-lock.json` with `npm install`, force-push the dependabot branch.
- The `docker-images` job's Trivy step can fail on pre-existing image CVEs
  unrelated to the dep bump; verify the same step fails on `main` before
  treating it as a regression.

## Design decisions

- **Dual credential sources**: environment variables for non-interactive deploys, runtime login for interactive use. Runtime takes priority.
- **Static + AI analysis**: static analysis runs on all zone pairs automatically. AI analysis is opt-in, requires API key, and results are cached by rule content hash.
- **Custom edge paths**: `RuleEdge.tsx` uses a custom `buildStepPath` function (not ReactFlow's `getSmoothStepPath`) to explicitly control horizontal segment y-positions for parallel routing.
- **Dagre layout with edge fan-out**: `layout.ts` computes per-edge X offsets (source and target) plus route offsets (max of outgoing and incoming index) so edges spread across node boundaries and route as parallel lines.
- **Zone matrix as default view**: matrix gives an at-a-glance overview. Clicking a cell or zone header navigates to the focused graph view. Browser back returns to matrix.
