# Frontend Architecture Scaling Design

Status: Accepted
Date: 2026-03-13

## Context

The frontend works well at A-scale (10-20 zones) but has maintainability bottlenecks:

- `RulePanel.tsx` is 881 lines with 10+ nested sub-components and 3 independent workflows.
- `App.tsx` (325 lines) orchestrates auth, filtering, navigation, and data loading in one place.
- `useFirewallData.ts` fetches all zones and all zone pairs in a single `Promise.all` with no caching, cancellation, or deduplication.
- `api/client.ts` has 24 bare `fetch` wrappers with no cache layer.
- The matrix renders all cells at once with no sticky headers, making 30+ zone grids hard to navigate.

## Goals

- Improve code maintainability and developer experience.
- Introduce a query/cache layer with automatic cancellation and deduplication.
- Keep B-scale (30-50 zones) working without special effort.
- Maintain 95% test coverage throughout.
- No new user-facing features beyond sticky headers and wider matrix cells.

## Non-goals

- C-scale (100+ zones) virtualization, clustering, or search/filter (separate roadmap item).
- RulePanel state extraction into dedicated hooks (separate roadmap item).
- Graph performance work (viewport culling, lazy edge rendering).

## Design

### Phase 1: TanStack Query adoption

**New dependency:** `@tanstack/react-query` (+ `@tanstack/react-query-devtools` in dev only).

**Setup:** `QueryClientProvider` wraps the app in `main.tsx`. Default config:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

**Query hooks** (new files in `hooks/`):

| Hook | Replaces | Query key |
|------|----------|-----------|
| `useZones()` | Half of `useFirewallData` | `["zones"]` |
| `useZonePairs()` | Other half of `useFirewallData` | `["zone-pairs"]` |
| `useAuthStatus()` | Manual fetch in App useEffect | `["auth-status"]` |
| `useAppAuthStatus()` | Manual fetch in App useEffect | `["app-auth-status"]` |
| `useAiConfig()` | `refreshAiConfig` callback chain | `["ai-config"]` |
| `useZoneFilter()` | Manual fetch/save in App | `["zone-filter"]` |
| `useSimulation()` | useState/fetch in RulePanel | `["simulation", params]` |
| `useAiAnalysis()` | useState/fetch in RulePanel | `["ai-analysis", zonePairKey]` |

**Mutations** (using `useMutation`):

| Mutation | Current pattern | Invalidates |
|----------|----------------|-------------|
| `useLogin()` | Manual fetch + setState | `["auth-status"]` |
| `useAppLogin()` | Manual fetch + setState | `["app-auth-status"]` |
| `useToggleRule()` | RulePanel fetch + refresh | `["zone-pairs"]` |
| `useSwapRuleOrder()` | RulePanel fetch + refresh | `["zone-pairs"]` |
| `useSaveAiConfig()` | SettingsModal fetch | `["ai-config"]` |
| `useSaveZoneFilter()` | Debounced save in App | `["zone-filter"]` |

**Deletions:**

- `useFirewallData.ts` and its test (replaced by `useZones` + `useZonePairs`).
- All manual loading/error/status state in App and RulePanel for data fetching.
- The `refreshAiConfig` callback chain in App.
- The debounced zone filter save timer (`useRef` + `setTimeout`).

**Cancellation:** TanStack Query uses AbortController automatically. Component unmount cancels in-flight requests.

### Phase 2: AuthContext extraction

**New files:** `hooks/useAuth.ts`, `hooks/useAuth.test.ts`.

**Context shape:**

```typescript
interface AuthContextValue {
  // App-level auth (passphrase gate)
  appAuthRequired: boolean
  appAuthenticated: boolean
  appLogin: (password: string) => Promise<void>

  // UniFi controller auth
  authed: boolean
  authLoading: boolean
  connectionInfo: ConnectionInfo | null
  login: (url: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}
```

**Provider placement:**

```
QueryClientProvider
  AuthProvider
    App
```

**What moves out of App.tsx:** 5 state properties (`appAuthRequired`, `appAuthenticated`, `authed`, `authLoading`, `connectionInfo`), 2 callbacks (`checkUnifiAuth`, `handleLogout`), and the 2 auth-checking useEffect blocks.

**Consumer changes:**

- `LoginScreen` calls `useAuth().login` instead of receiving `onLogin` prop.
- `PassphraseScreen` calls `useAuth().appLogin` instead of receiving `onSubmit` prop.
- `Toolbar` calls `useAuth().logout` instead of receiving `onLogout` prop.
- `App.tsx` reads `useAuth()` for conditional rendering.

**App.tsx after:** ~220 lines, 8 state properties, 5 callbacks. Focused on layout, navigation, and UI state.

### Phase 3: RulePanel file extraction

**New directory:** `components/rule-panel/`

| New file | Est. lines | Contents |
|----------|-----------|----------|
| `rule-panel/RuleCard.tsx` | ~80 | `RuleCard`, `RuleWriteControls`, `actionColor`, `actionBadge` |
| `rule-panel/RuleDetails.tsx` | ~120 | `RuleDetails`, `DetailSectionView`, `DetailRowView`, `buildDetailSections`, `formatSchedule`, `formatIpSec`, `resolveGrouped` |
| `rule-panel/SimulationForm.tsx` | ~70 | Simulation input form + submit |
| `rule-panel/SimulationResult.tsx` | ~60 | Result display, `verdictColor` |
| `rule-panel/FindingsList.tsx` | ~80 | `FindingsList`, `FindingCard`, `severityBadge`, `gradeColor` |
| `rule-panel/AiAnalysisStatus.tsx` | ~50 | AI analysis button, loading, cache indicator |
| `rule-panel/index.ts` | ~5 | Re-exports |

**RulePanel.tsx after:** ~250 lines. Composition shell owning the two reducers and wiring sub-components via props. This is a mechanical refactor: closures become explicit props interfaces.

**Testing:** Existing `RulePanel.test.tsx` (1594 lines) stays as integration tests. Each extracted component gets a focused unit test file.

### Phase 4: Matrix sticky headers and wider cells

CSS-only changes to `ZoneMatrix.tsx` and `MatrixCell.tsx`:

- Wrap the grid in a scrollable container with `max-height: calc(100vh - 160px)`.
- Column headers: `sticky top-0 z-10 bg-noc-surface`.
- Row headers: `sticky left-0 z-10 bg-noc-surface`.
- Top-left corner cell: `z-20` to stack above both axes.
- Widen cells from `minmax(52px, 84px)` to `minmax(72px, 108px)` for a more rectangular aspect ratio.

**Testing:** Assert sticky classes on header cells. Existing e2e tests cover matrix functionality.

## Ordering

Each phase ships independently and keeps tests green:

1. TanStack Query (foundation -- other phases build on the query hooks)
2. AuthContext (unblocks App.tsx simplification, uses login/logout mutations from phase 1)
3. RulePanel extraction (largest single improvement, simulation/AI hooks from phase 1 are already in place)
4. Sticky matrix headers (independent, small)

## Future roadmap items

These are explicitly deferred:

- **RulePanel hook extraction:** Split the two reducers into `useSimulation()`, `useAiAnalysis()`, `useRuleWrite()` hooks. Follow-up to phase 3 once the file extraction settles.
- **C-scale (100+ zones):** Virtualized matrix (TanStack Virtual), graph viewport culling, zone search/filter, graph clustering. Requires different interaction patterns.
