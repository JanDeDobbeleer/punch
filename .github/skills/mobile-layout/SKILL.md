---
name: mobile-layout
description: Mobile layout contract for Punch. Use when any task changes component layout, adds a new page or panel, modifies the sidebar or modal, touches index.css, or mentions mobile/responsive/viewport.
compatibility: No network access required. All content is inline.
metadata:
  generated_at: "2026-07-03"
  generator: "manual"
---
# Punch Mobile Layout Skill

## When to use this skill

Load this skill whenever a task:
- Adds or modifies a page, panel, or component (any `.tsx` in `src/components/`)
- Touches `src/index.css`
- Mentions "mobile", "responsive", "viewport", "375px", "iPhone", or similar
- Involves Playwright visual verification or screenshots

## Styling split — the most commonly violated convention

**Inline `style` props** (CSSProperties objects in `.tsx` files and in `useAppState.ts`):
- Structural layout: dimensions, flex, padding, margin, colour, typography, spacing
- Cannot contain `@media` queries — React does not support them in inline styles

**`src/index.css` CSS classes** (opted into via `className`):
- Anything needing `@media`, `:hover`, `:active`, `transition`, `animation`, `z-index`
- Mobile breakpoint overrides (`@media (max-width: 767px)`)

Do **not** introduce CSS modules, styled-components, Tailwind, or additional `<style>` blocks. One stylesheet (`index.css`), one set of inline styles. That is the entire styling system.

## CSS custom properties (exact values — do not approximate)

```css
:root {
  --touch-min: 44px;      /* iOS HIG minimum touch target */
  --sidebar-w: 236px;
  --bp-mobile: 767px;     /* ≤767px = mobile */
  --bp-tablet: 1023px;    /* 768–1023px = tablet */
}
```

The canonical mobile breakpoint is `@media (max-width: 767px)`. Always use this exact value, not `768px` or `max-width: 375px`.

## Critical mobile viewport

The canonical test viewport is **375 × 812px** (iPhone SE / 14 Mini width). This is where calendar overflow, label wrapping, and button crowding have historically broken. Always verify at this size before considering a UI task complete.

## Mandatory mobile checklist

Before marking any UI task done:

- [ ] Tested at **375px viewport width** (375 × 812px)
- [ ] All interactive elements have `min-height: var(--touch-min)` (44px). Calendar day cells use 48px.
- [ ] No `font-size` smaller than `16px` on `input`, `select`, or `textarea` (prevents iOS Safari auto-zoom on focus — enforced globally in `index.css`; do not override with an inline style)
- [ ] Full-height containers use `height: 100dvh` with `100vh` fallback, never bare `100vh` alone
- [ ] Sidebar drawer, FAB, and `isMobile` conditional rendering are consistent for the affected page
- [ ] Table-style list views have a `@media (max-width: 767px)` collapse rule in `index.css` hiding intermediate columns

Run `npm run test:e2e` — the Playwright suite includes viewport tests.

## Key CSS classes and their mobile behaviour

| Class | Desktop | Mobile (`≤767px`) |
|-------|---------|-------------------|
| `.sidebar` | Fixed left panel, `width: var(--sidebar-w)` | Off-screen drawer; slides in with `.sidebar--open` |
| `.sidebar--open` | N/A | Visible drawer, controlled by `isOpen` prop in `SidebarProps` |
| `.fab` | Hidden | Visible floating action button (replaces header "New" button) |
| `.cal-cell-earn` | Visible earnings label on calendar cells | `display: none !important` — too space-constrained |
| `.proj-grid-header` | Visible column headers | `display: none` — grid collapses to name + earnings only |

## FAB and "New" button

The FAB (`.fab`, `src/components/Fab.tsx`) replaces the header "New" button at `≤767px`. The switch is CSS-only: the header button is hidden via a media query; the FAB is shown. Do **not** add a second FAB or a second "New" button for mobile.

## Sidebar

The sidebar becomes a full-screen drawer at `≤767px`. It is controlled by:
- `isOpen?: boolean` prop on `SidebarProps`
- `onClose?: () => void` prop on `SidebarProps`
- `.sidebar--open` CSS class toggled by `useAppState.ts`
- The `useIsMobile()` hook (`src/hooks/useMediaQuery.ts`) drives the `isMobile` flag that the hook exposes

If you add new content to the sidebar, verify it renders correctly inside the drawer.

## `useIsMobile()` hook

```typescript
// src/hooks/useMediaQuery.ts
// Returns true when viewport width ≤ 767px
import { useMediaQuery } from './useMediaQuery';
const isMobile = useMediaQuery('(max-width: 767px)');
```

Use this for conditional rendering decisions that CSS alone cannot express (e.g. rendering a completely different component tree on mobile).

## Table-to-card collapses on mobile

Every list view (Projects, Services, Customers, Earnings) uses a CSS grid:
- Headers hidden at `≤767px` (`.proj-grid-header`, `.svc-grid-header`, etc.)
- Row grid collapses to `1fr auto` (name + earnings only)

When adding a new column to an existing list, add a corresponding mobile hiding rule in `index.css`.

## `dvh` and full-height containers

```css
/* Correct — from index.css */
.app-shell {
  height: 100dvh;   /* dynamic viewport height: browser chrome collapses correctly */
  /* fallback for browsers without dvh support is handled by cascade */
}
```

Never use bare `height: 100vh` on full-height containers — the mobile browser URL bar causes content to be clipped or jump.

## Deliberately removed: tap-to-log on calendar

The touch tap-to-log interaction on calendar day cells was **intentionally removed** in session *Remove Touch Interaction Calendar*. The FAB is the only entry creation path on mobile. Do not add it back — it causes accidental entry creation when users intend to swipe between months.

## Common mistakes

| Mistake | Consequence | Observed in session |
|---------|-------------|---------------------|
| Using `height: 100vh` on full-height containers | Content clipped behind mobile browser chrome | *Fix Mobile Track Page Layout* |
| Not adding `@media (max-width: 767px)` rule for a new column | New column overflows or breaks mobile row layout | *Investigate Mobile Layout Issues* |
| Setting `font-size < 16px` on an input via inline style | iOS Safari auto-zooms on focus, breaking scroll position | *Fix Mobile Track Page Layout* |
| Adding a second FAB for mobile | Two overlapping action buttons | — |
| Re-adding tap-to-log on calendar cells | Accidental entry creation when swiping; fights scroll gesture | *Remove Touch Interaction Calendar* |
| Forgetting `isOpen`/`onClose` props on sidebar content for new pages | Sidebar drawer does not close after navigation on mobile | *Investigate Mobile Layout Issues* |
