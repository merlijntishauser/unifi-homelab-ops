# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Redesigned UI to match Ubiquiti/UniFi aesthetic with custom dual-theme token system
- Replaced generic Tailwind gray palette with purpose-built light (`ui-*`) and dark (`noc-*`) tokens
- Consolidated typography from three fonts (Lexend, Outfit, IBM Plex Mono) to two (Inter, IBM Plex Mono)
- Custom layered ambient shadows replacing Tailwind defaults, auto-switching between themes
- Toolbar uses glassmorphism (backdrop-blur with semi-transparent background)
- Borders are now nearly invisible, relying on elevation and background contrast
- Dropped purple accent color in favor of single UniFi blue (#006fff) throughout
- Replaced default Vite favicon with branded "U" icon

### Added
- Responsive mobile layout for iPad (768px+) and iPhone (375px+)
- Bottom navigation bar on mobile replacing the sidebar
- Notification bell in toolbar on mobile screens
- Full-screen overlays for RulePanel, DevicePanel, and SettingsModal on mobile
- Safe area support for iOS notch and gesture bar
- Touch-target compliance (44px minimum) on all interactive elements
- `useIsMobile` and `useIsPhone` viewport hooks

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

[Unreleased]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/merlijntishauser/unifi-homelab-ops/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/merlijntishauser/unifi-homelab-ops/releases/tag/v1.0.0
