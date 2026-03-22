# UI/UX Design Review -- UniFi Homelab Ops

**Date:** 2026-03-22
**Scope:** Full UI/UX evaluation across all modules, both themes, desktop and mobile viewports
**Method:** Code review + visual inspection using UI/UX Pro Max design intelligence framework

---

## Summary

Overall the app is in excellent shape. The dark NOC aesthetic is well-executed, the design token system is thorough, and the responsive mobile/desktop split works cleanly. Below are the findings organized by severity, following the UI/UX Pro Max checklist priority categories.

---

## CRITICAL -- Accessibility

### 1. No `prefers-reduced-motion` support

All animations (`animate-fade-in`, `animate-slide-right`, `animate-slide-up`, spinner `animate-spin`) play unconditionally. Users who have enabled "Reduce motion" in their OS settings still get all transitions.

**Fix needed in `index.css`:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Affected files:** `frontend/src/index.css`

### 2. No skip-to-content link

With 7+ nav items in the sidebar, keyboard users must tab through all of them to reach the main content area.

**Affected files:** `frontend/src/components/AppShell.tsx`

### 3. Heading hierarchy gap on Health page

The summary cards use `h3` ("Firewall", "Topology", "Metrics") but there is no preceding `h2`. The next heading is `h2` ("AI Cross-Domain Analysis"). Screen readers navigating by heading will see a gap from `h1` to `h3`.

**Affected files:** `frontend/src/components/HealthModule.tsx`

---

## HIGH -- Consistency Issues

### 4. Input padding varies across three definitions

| Location | Variable | Padding |
|---|---|---|
| `LoginScreen.tsx:48` | `inputClass` | `py-2.5` |
| `SettingsModal.tsx:70` | `INPUT_CLASS` | `py-2` |
| `RulePanel.tsx:130` | `inputClass` | `py-2.5 lg:py-1.5` |

These should be a single shared constant. The visual height difference between the Login screen inputs and Settings modal inputs is noticeable.

### 5. Backdrop overlay opacity is inconsistent

| Component | Opacity |
|---|---|
| `SettingsModal.tsx` | `bg-black/50 dark:bg-black/60` |
| `ConfirmDialog.tsx` | `bg-black/40` |
| `NotificationDrawer.tsx` | `bg-black/30` |

A modal hierarchy should be consistent. Recommendation: use `bg-black/50 dark:bg-black/60` everywhere, with optional `backdrop-blur-sm` for focus-stealing modals.

### 6. Close button pattern varies

| Component | Implementation | Min touch target |
|---|---|---|
| `SettingsModal` | `x` character, flex with 44px min | Yes |
| `RulePanel` | `x` character, `text-lg leading-none` | **No** |
| `NotificationDrawer` | SVG X icon, 44px min | Yes |

The RulePanel close button lacks `min-w-[44px] min-h-[44px]`, making it a small tap target especially on mobile where it renders full-screen.

### 7. Backdrop ARIA roles inconsistent

- SettingsModal: `role="button"` -- incorrect for a dismissible backdrop
- ConfirmDialog: `role="presentation"` -- correct
- NotificationDrawer: `role="button"` -- incorrect

Backdrops should use `role="presentation"` since they aren't true interactive elements.

### 8. PassphraseScreen uses hardcoded colors instead of tokens

`PassphraseScreen.tsx:27`: `bg-[#f0f2f5] dark:bg-[#080b12]`

This bypasses the theme token system. `LoginScreen.tsx` correctly uses `bg-ui-bg dark:bg-noc-bg`. The two auth screens should look like they belong to the same app.

---

## HIGH -- Navigation

### 9. Mobile bottom nav is incomplete

The sidebar has 7 modules: Health, Metrics, Topology, Firewall, Docs, Rack, Home Assistant. The bottom nav only shows 4 + Settings (5 total). **Docs, Rack, and Home Assistant are unreachable on mobile** without the sidebar.

Options:
- Add an overflow "More" item in the bottom nav that opens a sheet with the remaining modules
- Or include all 7 items with horizontal scroll (less ideal but functional)

### 10. Mobile StatusBadge labels hidden

`Toolbar.tsx:36`: Badge labels use `hidden md:inline`, so on mobile the toolbar shows only tiny colored dots with no text. Users can't tell what "Controller" and "AI" badges mean without hovering (which doesn't exist on mobile).

---

## MEDIUM -- Forms & Feedback

### 11. No `autocomplete` attributes on login forms

Both `LoginScreen.tsx` and `PassphraseScreen.tsx` lack `autocomplete` attributes (`autocomplete="url"`, `autocomplete="username"`, `autocomplete="current-password"`). The browser console warns about this. Password managers and autofill won't work properly.

### 12. No password visibility toggle

Password fields across LoginScreen, PassphraseScreen, and SettingsModal lack a show/hide toggle. This is a standard UX expectation per UI/UX Pro Max rule `password-toggle`.

### 13. No required field indicators

Login form fields are `required` in HTML but have no visual asterisk or "(required)" label. Users don't know which fields are mandatory until they try to submit.

---

## MEDIUM -- Code Consistency

### 14. Duplicated SVG icons across BottomNav and ModuleSidebar

`BottomNav.tsx` and `ModuleSidebar.tsx` define identical SVG constants (`shieldIcon`, `networkIcon`, `activityIcon`, `heartPulseIcon`, `settingsIcon`). These should be extracted to a shared `icons.tsx` file.

### 15. Duplicated `formatRelativeTime` utility

`NotificationDrawer.tsx:22` and `HealthModule.tsx:173` both define nearly identical relative time formatting functions (`formatRelativeTime` and `formatTimeAgo`). Should be a single utility in `utils/`.

### 16. Inconsistent tooltip implementation

All tooltips use the same CSS pattern (`absolute top-full left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100`) repeated inline across multiple components (Toolbar, MatrixCell, StatusBadge). This should be a shared component or utility class. Additionally, edge-positioned tooltips (e.g., the rightmost status badge) risk overflowing off-screen.

---

## LOW -- Polish

### 17. Theme toggle UX is non-obvious

The theme cycles through Dark -> System -> Light -> Dark on each click. There's no visual indication that three states exist. Users expecting a simple dark/light toggle may not realize "System" is an option. The tooltip helps but is hover-only (invisible on mobile).

### 18. Health summary cards lack visual separation in dark mode

The `SummaryCard` component has a colored left border but no background differentiation from the content area. In dark mode they blend into the background more than in light mode, where the white cards clearly stand out against the gray background.

### 19. `ub-purple` token documented but not defined

`AGENTS.md` lists `ub-purple` as an accent token, but it doesn't exist in `index.css`. The documentation is stale.

---

## What's Working Well

- **Token system** is comprehensive and well-structured (light `ui-*` / dark `noc-*` / brand `ub-*` / status)
- **Consistent button patterns** with proper disabled states, cursor changes, and loading text
- **Responsive layout** with sidebar/bottom-nav split and proper `h-dvh` usage
- **Safe area support** with `pt-safe`, `pb-safe` utilities
- **Deep linking** for firewall pairs and device metrics
- **Loading states** are consistent (spinner + text pattern reused everywhere)
- **Dark/light mode** both look professional; the NOC dark theme is distinctive
- **ARIA labels** on icon-only buttons are consistently applied
- **Touch targets** are generally 44px minimum (with the RulePanel close button exception)
- **Custom scrollbar** styling adapts to both themes
- **ReactFlow theming** is thoroughly customized for both modes
- **No emojis used as icons** -- all SVG, consistent stroke style
- **Form labels** properly associated via `htmlFor`
- **Error messages** displayed near the relevant field with consistent styling

---

## Priority Action Items

| Priority | Item | Impact |
|---|---|---|
| 1 | Add `prefers-reduced-motion` media query | Accessibility, quick win |
| ~~2~~ | ~~Fix mobile bottom nav to include all modules~~ | ~~Done~~ |
| ~~3~~ | ~~Unify input/backdrop/close-button patterns across all modals~~ | ~~Done~~ |
| ~~4~~ | ~~Add `autocomplete` attributes to login forms~~ | ~~Done~~ |
| 5 | Fix PassphraseScreen to use theme tokens instead of hardcoded hex | Token consistency |
| 6 | Extract shared icons and utilities to reduce duplication | Maintainability |
| 7 | Add skip-to-content link | Keyboard accessibility |
| 8 | Fix heading hierarchy on Health page | Screen reader navigation |
| 9 | Add password visibility toggle | Standard UX expectation |
| 10 | Fix backdrop ARIA roles to `role="presentation"` | Semantic correctness |