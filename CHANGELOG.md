# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Metrics detail page redesign**: device info card (model, MAC, IP, firmware, uptime), color-coded stat strip with health thresholds (CPU/memory/temperature/PoE), and conditional charts
- **Separate TX/RX traffic charts** with delta-computed throughput, total and peak rate (/s) labels
- **Connected Clients chart** for access points (conditional on device type)
- **PoE Consumption chart** with budget reference line for PoE switches
- **AI device insights**: per-device 24h metrics analysis via configured AI provider (POST /api/metrics/devices/{mac}/analyze)
- `ip` field on MetricsSnapshot, sourced from raw controller device data
- PoE utilization bar on device metric overview cards with color thresholds
- Hover background effect on metrics device cards matching Health card pattern
- "Uptime:" prefix on device card uptime display

### Fixed
- Chart axis labels unreadable in dark mode (replaced currentColor with theme CSS variables)
- Rack Planner form inputs and selects now use shared INPUT_CLASS/SELECT_CLASS for consistent styling
- Tooltip fly-in animation disabled on recharts for snappier interaction

### Changed
- Chart height increased from 120px to 160px with 12px top margin for label spacing
- Recharts added as dependency (3.8.0, MIT) replacing custom inline SVG sparklines
- MetricsDetailView lazy-loads MetricsChart to code-split recharts
- Removed unused DualMetricsChart after TX/RX chart split

## [1.1.2] - 2026-03-22

### Added
- Skip-to-content link for keyboard accessibility (visible on Tab focus)
- Password visibility toggle on all password fields (LoginScreen, PassphraseScreen, SettingsModal)
- Mobile bottom nav "More" overflow menu providing access to Docs, Rack Planner, Home Assistant, and Settings
- Theme picker popover replacing the non-obvious cycling toggle (shows Light, Dark, System options)
- Shared Tooltip component with center/left/right alignment
- Shared PasswordInput component with show/hide toggle
- Shared icon library (components/icons.tsx) and formatRelativeTime utility (utils/format.ts)
- UI/UX design review document (docs/design-review.md)

### Fixed
- `prefers-reduced-motion` now respected: all animations and transitions disabled when OS setting is active
- Mobile StatusBadge labels ("Controller", "AI") now always visible instead of hidden behind hover-only tooltips
- Toolbar title no longer wraps on narrow screens; status badges stack below title on mobile
- Health page heading hierarchy fixed (h1 -> h2 -> h3 instead of skipping h2)
- Health summary cards now visually separated in dark mode with border, shadow, and background strip for status colors
- PassphraseScreen background uses theme tokens instead of hardcoded hex values
- Backdrop overlays unified to consistent opacity (`bg-black/50 dark:bg-black/60 backdrop-blur-sm`) and correct `role="presentation"`
- Close buttons on RulePanel and DevicePanel now meet 44px minimum touch target
- Input padding unified across LoginScreen, SettingsModal, and RulePanel (shared INPUT_CLASS)
- Settings modal tab icons enlarged to match sidebar navigation icon size
- Settings modal action buttons (Save, Test Connection, Delete) now have consistent height
- Select inputs styled with `appearance-none`, custom chevron, and explicit height matching text inputs
- Toolbar buttons across all modules now have consistent height and proper flex alignment
- `autocomplete` attributes added to all login forms for proper browser autofill
- `react-hooks/exhaustive-deps` warnings in useNotificationState resolved
- `act()` warnings in DocumentationModule mermaid tests resolved

### Changed
- Route modules lazy-loaded via React.lazy() with Suspense fallback (main bundle: 1,345 kB -> 280 kB)
- Vendor chunks split: react-vendor (99 kB), @xyflow/react (179 kB), mermaid (492 kB)
- Duplicated SVG icons across BottomNav and ModuleSidebar consolidated into shared icons.tsx
- Duplicated formatRelativeTime/formatTimeAgo consolidated into shared utils/format.ts
- Inline tooltip patterns replaced with shared Tooltip component across Toolbar and MatrixCell
- Topology "Export SVG/PNG" renamed to download icon + "SVG/PNG" matching Documentation module pattern
- Documentation "Export Markdown" renamed to download icon + "Complete Markdown"
- Toolbar padding increased and button height reduced for better proportions

## [1.1.1] - 2026-03-21

### Added
- Home Assistant integration promotion page with HACS install link and feature overview
- Version display in sidebar showing build version, commit hash, and date (e.g. "v1.1.0 (abc1234, Mar 21, 2026)")
- Docker Hub update checker: hourly check for newer semver releases with amber alert in sidebar
- Confirmation dialog before deleting a rack
- Build metadata injection via Vite define (BUILD_VERSION, BUILD_COMMIT, BUILD_DATE)
- App logout button in toolbar (visible only when authenticated via app password)
- CSS grid pattern background on login screen with blue glow, dots, and frosted glass card (works in both themes)

### Fixed
- Notification dismiss not removing items from drawer (dismissed notifications were still returned by the API)
- Missing cursor-pointer and hover states on Dismiss and Dismiss All buttons in notification drawer
- Docker multi-arch merge job failing due to incorrect artifact path
- Topology nodes showing platform codes (e.g. "UDMA6A8") instead of friendly model names (e.g. "Dream Machine Pro Max") -- now resolved via unifi-topology library lookup

### Changed
- Navigation reordered: Health, Metrics, Topology, Firewall, Docs, Rack (Health is now the default landing page)
- Docker builds use native arm64 runners instead of QEMU emulation (~30 min -> ~5 min)

## [1.1.0] - 2026-03-21

### Added
- **Documentation Generator module**: browsable network documentation with Mermaid topology diagrams, device inventory, port overview, LLDP neighbors, firewall summary, and metrics snapshot sections
- **Rack Planner module**: visual rack editor with drag-and-drop, 10"/19" rack support, fractional U heights (0.5U), fractional widths (quarter/half/full), power budget tracking, bill of materials, and auto-populate from topology
- UniFi device picker with live specs from unifi-topology library (replaces static JSON catalog)
- Inline editing for rack items via side panel form
- Responsive mobile layout for iPad (768px+) and iPhone (375px+) with bottom navigation bar
- Full-screen overlays for RulePanel, DevicePanel, and SettingsModal on mobile
- Safe area support for iOS notch and gesture bar
- `useIsMobile` and `useIsPhone` viewport hooks
- Notification deep-linking: clicking a notification navigates to `/metrics?device={mac}`
- `RequireCredentials` FastAPI dependency replacing repeated credential boilerplate across 8 routers
- `useNotificationState` hook consolidating notification query, badge count, dismiss, and dismissAll
- Controller credential validation on login (returns 401 for bad credentials instead of storing them)
- Per-section copy/download buttons (Markdown, JSON, SVG, PNG) in Documentation module
- Device hostname resolution via DNS in documentation inventory
- Markdown table rendering with remark-gfm
- Docker Compose example in README
- Live screenshots of all modules in README
- CONTRIBUTING.md with development setup, architecture, and code conventions

### Fixed
- AI cache key now includes rule descriptions (previously a description-only change returned stale cached findings)
- Site-health cache key now hashes the full prompt instead of just aggregate counts (two sites with same counts but different details no longer collide)
- Zone pairs now include all zone combinations, not just those with existing rules (the "no-explicit-rules" finding was previously unreachable)
- Topology edge resolution handles duplicate device names safely (skips ambiguous edges with warning instead of silently misresolving)
- Session cookie now sets `Secure` flag when served over HTTPS (was missing, leaving cookie eligible for plain HTTP)
- Notification badge excludes resolved notifications (was overstating active alerts by counting resolved-but-not-dismissed)
- Debounced zone filter save timer cleaned up on unmount and logout (pending save could fire against stale session)
- MermaidDiagram async effect has cancellation guard (unmount or rapid prop change no longer triggers stale state updates)
- Rack item delete button no longer intercepted by drag handler
- Rack delete not updating UI until page refresh (204 No Content response was silently failing JSON parse)
- Rack item colors in dark/light mode now use CSS custom properties for theme reactivity
- Duplicate zone IDs in hidden zone filter are deduplicated instead of causing database integrity error
- Topology persisted enum values validated instead of unsafe `as` casting
- ESLint config ignores coverage directory

### Changed
- All blocking controller and AI HTTP calls moved off the event loop with `asyncio.to_thread()`
- Background metrics poller extracted to `_poll_once()` for clean shutdown cancellation at await boundaries
- Duplicate controller fetches consolidated in health summary and documentation (single fetch pass)
- Export/download logic deduplicated: DocumentationModule uses shared `downloadPng`/`downloadSvg` helpers
- Rack import uses `_find_free_position` (fractional-aware) instead of integer-only `_find_next_free_position`
- Redesigned UI to match Ubiquiti/UniFi aesthetic with custom dual-theme token system (`ui-*` light, `noc-*` dark)
- Consolidated typography to Inter + IBM Plex Mono
- Toolbar uses glassmorphism with backdrop-blur
- README rewritten for homelab enthusiasts with badges, screenshots, and Docker Compose example
- Upgraded unifi-topology from 1.3.0 to 1.3.2

## [1.0.1] - 2026-03-16

### Fixed
- Topology devices showing as offline after first request due to unifi-topology cache stripping the `state` field (fixed upstream in unifi-topology 1.2.1)
- Metrics device cards showing model codes (e.g. "U6M") instead of friendly names (e.g. "Access Point U6 Mesh"), now resolved via unifi-topology 1.2.5 model lookup table with model code fallback
- Flaky `_maybe_prune` test failing on CI runners with short uptime (`time.monotonic()` < 3600)
- CVE-2026-0861 (glibc heap corruption, HIGH) by applying OS security patches in Docker runtime images

### Changed
- Rewritten README covering all four modules, configuration reference, Docker tags, and release process
- Upgraded unifi-topology from 1.2.0 to 1.2.5
- Bumped GitHub Actions: actions/cache v5, docker/setup-buildx-action v4, docker/build-push-action v7, docker/setup-qemu-action v4, docker/metadata-action v6, docker/login-action v4, actions/upload-artifact v7

## [1.0.0] - 2026-03-15

First stable release. Four modules providing firewall analysis, network topology visualization,
device metrics monitoring, and unified site health assessment for UniFi networks.

### Firewall Module
- Zone matrix overview with grade-colored cells
- Interactive ReactFlow graph with zone nodes and rule edges
- Rule panel with expand/collapse, action badges, match criteria
- Static analysis: 11 security checks with severity scoring and letter grades
- AI-powered analysis: OpenAI and Anthropic provider support with caching
- Traffic simulator with rule evaluation chain
- Rule toggle (enable/disable) and reorder with confirmation dialogs
- Zone filtering (hide/show zones)

### Topology Module
- Interactive device map (ReactFlow) with device panels and port tables
- SVG diagram view with orthogonal and isometric projections
- Export to SVG and PNG
- Device detail panel with port status and LLDP neighbors

### Metrics Module
- Background device stats poller with 24h SQLite retention
- Device grid with CPU, memory, temperature, uptime sparklines
- Device detail view with time-series charts
- Anomaly detection (CPU, memory, temperature, PoE, reboot)
- Notification system with severity levels and dismissal

### Site Health Module
- Summary cards aggregating status from all three modules
- Colored status borders (green/yellow/red) based on health
- AI cross-domain analysis with entity-level prompt context
- Severity-grouped finding cards with module badges
- Deep-link click-through to affected entities in other modules
- Result caching with composite hash key

### Platform
- Single-container Docker image (Debian and Alpine variants)
- Multi-arch builds (amd64, arm64)
- Dual credential sources (environment variables, runtime login)
- App authentication gate with HMAC session cookies
- Settings modal with AI provider configuration and site profiles
- Sidebar navigation with module routing
- Dark theme with UniFi-inspired design tokens
- Structured logging with access log middleware

### Quality
- 98%+ Python test coverage (mypy strict, ruff)
- 95%+ TypeScript test coverage (strict mode, ESLint complexity)
- Playwright e2e suites (dev and production)
- Trivy security scanning in CI
- Alembic database migrations

[Unreleased]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/merlijntishauser/unifi-homelab-ops/releases/tag/v1.0.0
