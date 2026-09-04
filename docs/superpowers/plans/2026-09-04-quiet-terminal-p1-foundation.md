# Quiet Terminal P1: Foundation and Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Purpleberg Terminal's visual system and shell with the Quiet Terminal foundation (tokens, component kit, in-house router, persistent stores, quote pool, command line, quick-look drawer, alerts, session clock, Settings) while every existing screen keeps running underneath.

**Architecture:** New code lives in `src/theme`, `src/lib`, `src/stores`, `src/router`, `src/data`, `src/ui`, `src/shell`, `src/features`. The old screens stay mounted through adapter routes until Plans P2 and P3 replace them; `src/hooks.js`, `src/api.js`, and `src/config.js` become re-export shims so untouched screens keep importing what they import today. Pure logic is in `.js` files with `node:test` tests; React components are `.jsx` and are verified in the browser at the end.

**Tech Stack:** React 18, Vite 5, Recharts 2, Lucide, Express 4, `node --test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-quiet-terminal-redesign-design.md`. This plan covers spec sections 3, 4, 5, 6, 7.1, 7.2, 7.4, 7.5, 7.7, 7.8, 7.10, 7.11, and the foundation half of 9 and 10. Plan P2 covers the market screens (8) and 7.3, 7.6; Plan P3 covers Portfolio (7.9), old-code deletion, README, and the final verification.

---

## Conventions for every task

- Work on branch `redesign/quiet-terminal` (created in Task 1). Commit after every task with the message shown; every commit message ends with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run tests with `npm test`. It runs `node --test src/**/*.test.js server/**/*.test.js`; Node 24 expands the globs itself, so new tests anywhere under `src/` are picked up.
- Tests never import `.jsx`. Anything that must be unit-tested lives in a `.js` module without React.
- Whenever a task touches a module the old screens import, run `npx vite build` before committing. Expected output ends with `✓ built in …s` and no red errors.
- The dev servers are started with the Browser pane, never with Bash: `preview_start` with `name: "backend"` (port 3001) and `name: "frontend"` (port 5173) from `.claude/launch.json`.
- Class names: every new kit class starts with `pb-` but never reuses a legacy name that `src/shared.jsx` or an old screen still uses (`pb-panel`, `pb-badge`, `pb-btn`, `pb-tab`, `pb-tabbar`, `pb-table`, `pb-row`, `pb-link-row`, `pb-datacell*`, `pb-mono`, `pb-pos`, `pb-neg`). The new names are `pb-section`, `pb-tag`, `pb-button`, `pb-tabs`, `pb-dt`, `pb-up`, `pb-down`.
- No em dashes in UI copy; use a single hyphen or a middle dot. Labels are uppercase terminal vocabulary (LAST, CHG, MKT CAP, VOL, 52W HI).

## File structure

Created in this plan:

| Path | Responsibility |
|---|---|
| `src/theme/index.css` | All tokens, base styles, kit and shell classes, and a temporary legacy block |
| `src/theme/resolveTheme.js` | Pure theme and density resolution |
| `src/theme/applyTheme.js` | Applies `data-theme` and `data-density` to `<html>`, exposes the resolved theme |
| `src/theme/useResolvedTheme.js` | React hook over `applyTheme` |
| `src/lib/id.js` | `newId()` |
| `src/lib/format.js` | All number, date, and time formatters (moved from `config.js`, extended) |
| `src/lib/marketHolidays.js` | NYSE holiday and early-close dates 2026 to 2027 |
| `src/lib/session.js` | NYSE session state and countdown, Eastern-time helpers |
| `src/lib/alerts.js` | Alert evaluation |
| `src/stores/createStore.js` | Persistent store factory plus `memoryStorage()` for tests |
| `src/stores/useStore.js` | `useStore(store, selector)` hook |
| `src/stores/settings.js`, `ui.js`, `watchlist.js`, `alerts.js`, `savedScreens.js`, `portfolio.js` | Domain stores and their pure helpers |
| `src/stores/index.js` | Store registry, export, import, reset |
| `src/router/match.js` | Pure path matching, query parsing, path building |
| `src/router/routes.js` | Route table, mnemonics, aliases, `pathFor` |
| `src/router/index.jsx` | History wiring, `useRoute`, `navigate`, `updateQuery`, `Link` |
| `src/data/api.js` | Moved from `src/api.js`, plus `status()` |
| `src/data/hooks.js` | Moved from `src/hooks.js`; polling hooks gain `updatedAt`, `error`, `pollSeq`, `refetch`, interval scaling |
| `src/data/polling.js` | `scaleInterval()` |
| `src/data/symbols.js` | `dedupeSymbols()` |
| `src/data/feedState.js` | Pure online/offline reducer |
| `src/data/feedStatus.js` | In-memory feed status store and `reportPoll()` |
| `src/data/poolExtras.js` | Ref-counted ad-hoc symbols for the quote pool |
| `src/data/quotePool.jsx` | `QuotePoolProvider`, `useQuotePool`, `useQuote`, `usePoolQuotes` |
| `src/ui/*.jsx` | Kit components (Section, Grid, Stat, KV, Change, Price, Tag, Button, Input, Select, Kbd, Segmented, Tabs, EmptyState, Loading, Skeleton, Sparkline, Freshness, DataTable, Drawer, Toasts, Dialog, ListDetail, ChartFrame, Ticker) |
| `src/ui/sparklinePath.js`, `freshness.js`, `tableUtils.js`, `layers.js`, `focusTrap.js`, `toasts.js`, `useNow.js`, `dialog.js` | Pure helpers and module stores behind the kit |
| `src/features/watchlistActions.js` | `toggleWatch()` with an undo toast |
| `src/features/quickLook.jsx` | `QuickLookProvider`, `useQuickLook`, the quick-look drawer |
| `src/features/useAlertsEngine.js` | Evaluates alerts on every quote-pool update |
| `src/features/newsFeed.jsx` | `NewsProvider`, `useNewsFeed` |
| `src/shell/commandParser.js` | Pure command grammar |
| `src/shell/commandLine.js` | Tiny bus so the keyboard layer can focus the command line |
| `src/shell/CommandLine.jsx`, `TopBar.jsx`, `SessionClock.jsx`, `AlertsBell.jsx`, `Sidebar.jsx`, `BottomTape.jsx`, `MobileTabs.jsx`, `OfflineBanner.jsx`, `ShortcutSheet.jsx`, `AppShell.jsx` | Shell |
| `src/shell/keyboard.js` | Global key handling |
| `src/screens/Settings.jsx` | Settings screen |

Modified: `index.html`, `vite.config.js`, `package.json` (version), `src/main.jsx`, `src/App.jsx` (rewritten), `src/ThemeContext.jsx` (bridge), `src/config.js` (re-exports), `src/ErrorBoundary.jsx` (tokens), `server/index.js` (`/api/status`).

Deleted: `src/index.css`, `src/components/*`, `src/navConfig.jsx`, `src/screens/RiskAnalytics.jsx`, `src/hooks.js` and `src/api.js` become one-line shims.

---

### Task 1: Branch, font, tokens, base CSS, legacy palette bridge

**Files:**
- Modify: `index.html`
- Create: `src/theme/index.css`
- Delete: `src/index.css`
- Modify: `src/main.jsx`
- Modify: `src/ThemeContext.jsx` (the `DARK` and `LIGHT` objects only)

- [ ] **Step 1: Create the branch**

Run:
```bash
git checkout -b redesign/quiet-terminal
```
Expected: `Switched to a new branch 'redesign/quiet-terminal'`

- [ ] **Step 2: Replace `index.html`**

Full new content:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Purpleberg Terminal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <script>
      // Paint the saved theme before the bundle loads so a light-theme user
      // does not see a black flash. Mirrors src/theme/applyTheme.js.
      try {
        var s = JSON.parse(localStorage.getItem("purpleberg.settings") || "{}");
        var dark = s.theme === "light" ? false
          : s.theme === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : true;
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        document.documentElement.dataset.density = s.density === "comfortable" ? "comfortable" : "compact";
      } catch (e) {}
    </script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { background: #000; }
      html[data-theme="light"] { background: #f4f4f1; }
      body { overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/theme/index.css`**

```css
/* ============================================================
   Purpleberg Terminal - Quiet Terminal design system
   One monospaced family, one canvas tone, hairline separation,
   one accent. Tokens flip on <html data-theme> and
   <html data-density>. Kit and shell classes are appended in
   later tasks; the LEGACY block at the bottom is deleted in P2.
   ============================================================ */

:root {
  --font-mono: "IBM Plex Mono", ui-monospace, Consolas, "Liberation Mono", Menlo, monospace;

  --fs-label: 11px;
  --fs-xs: 10px;

  --t-fast: 150ms ease-out;
  --t-slide: 180ms ease-out;

  --top-h: 32px;
  --tape-h: 22px;
  --side-w: 152px;
  --side-w-collapsed: 44px;
  --drawer-w: 360px;

  --z-shell: 20;
  --z-layer: 100;
  --z-toast: 200;
}

/* ---- Dark (default) ---- */
:root,
:root[data-theme="dark"] {
  --c-bg: #000000;
  --c-raised: #0d0d0d;
  --c-line: #222222;
  --c-line-strong: #3a3a3a;
  --c-text: #e8e8e8;
  --c-text-dim: #a3a3a3;
  --c-text-muted: #787878;
  --c-accent: #8b5cf6;
  --c-accent-text: #a78bfa;
  --c-on-accent: #ffffff;
  --c-up: #22c55e;
  --c-down: #ef4444;
  --c-warn: #f59e0b;
  --c-selected: rgba(139, 92, 246, 0.12);
  --c-hover: rgba(255, 255, 255, 0.04);
  --c-flash-up: rgba(34, 197, 94, 0.22);
  --c-flash-down: rgba(239, 68, 68, 0.22);
  --c-scrim: rgba(0, 0, 0, 0.55);
  color-scheme: dark;
}

/* ---- Light ("paper") ---- */
:root[data-theme="light"] {
  --c-bg: #f4f4f1;
  --c-raised: #ffffff;
  --c-line: #d6d6d0;
  --c-line-strong: #b8b8b0;
  --c-text: #161616;
  --c-text-dim: #4a4a4a;
  --c-text-muted: #6e6e6e;
  --c-accent: #6d28d9;
  --c-accent-text: #5b21b6;
  --c-on-accent: #ffffff;
  --c-up: #15803d;
  --c-down: #dc2626;
  --c-warn: #b45309;
  --c-selected: rgba(109, 40, 217, 0.08);
  --c-hover: rgba(0, 0, 0, 0.03);
  --c-flash-up: rgba(21, 128, 61, 0.16);
  --c-flash-down: rgba(220, 38, 38, 0.16);
  --c-scrim: rgba(20, 20, 20, 0.35);
  color-scheme: light;
}

/* ---- Density ---- */
:root,
:root[data-density="compact"] {
  --fs-base: 12px;
  --fs-sm: 11px;
  --fs-lg: 14px;
  --fs-xl: 18px;
  --row-h: 24px;
  --cell-px: 8px;
  --cell-py: 4px;
  --sec-pad: 10px;
  --ctl-h: 24px;
}
:root[data-density="comfortable"] {
  --fs-base: 13px;
  --fs-sm: 12px;
  --fs-lg: 15px;
  --fs-xl: 20px;
  --row-h: 30px;
  --cell-px: 12px;
  --cell-py: 6px;
  --sec-pad: 14px;
  --ctl-h: 28px;
}

/* ============================================================
   Base
   ============================================================ */
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-base);
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { font: inherit; color: inherit; background: none; border: 0; border-radius: 0; }
button { cursor: pointer; }
a { color: var(--c-accent-text); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3, h4 { font-size: inherit; font-weight: 500; }
:focus { outline: none; }
:focus-visible { outline: 1px solid var(--c-accent); outline-offset: -1px; }
* { -webkit-tap-highlight-color: transparent; }
input::placeholder { color: var(--c-text-muted); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--c-line-strong); }
::-webkit-scrollbar-thumb:hover { background: var(--c-text-muted); }

/* ============================================================
   Utilities
   ============================================================ */
.pb-up { color: var(--c-up); }
.pb-down { color: var(--c-down); }
.pb-warn { color: var(--c-warn); }
.pb-muted { color: var(--c-text-muted); }
.pb-dim { color: var(--c-text-dim); }
.pb-accent { color: var(--c-accent-text); }
.pb-label { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); }
.pb-right { text-align: right; }
.pb-nowrap { white-space: nowrap; }
.pb-reset { appearance: none; background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-align: inherit; cursor: pointer; }
.pb-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@keyframes pb-flash-up { from { background-color: var(--c-flash-up); } to { background-color: transparent; } }
@keyframes pb-flash-down { from { background-color: var(--c-flash-down); } to { background-color: transparent; } }
@keyframes pb-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes pb-slide-in { from { transform: translateX(12px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pb-rise { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
.pb-flash-up { animation: pb-flash-up 0.6s ease-out; }
.pb-flash-down { animation: pb-flash-down 0.6s ease-out; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/* ============================================================
   LEGACY - flat stand-ins for classes src/shared.jsx and the old
   screens still use. Deleted in Plan P2 with the last old screen.
   ============================================================ */
.pb-mono { font-family: var(--font-mono); }
.pb-pos { color: var(--c-up); }
.pb-neg { color: var(--c-down); }
.pb-panel { border: 1px solid var(--c-line); background: var(--c-bg); min-width: 0; overflow: hidden; }
.pb-panel-header { display: flex; align-items: center; justify-content: space-between; min-height: var(--row-h); padding: 0 var(--cell-px); border-bottom: 1px solid var(--c-line); }
.pb-panel-header__title { font-size: var(--fs-label); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-accent-text); }
.pb-panel-header__sub { font-size: var(--fs-label); color: var(--c-text-muted); }
.pb-badge { display: inline-flex; align-items: center; gap: 4px; padding: 0 4px; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid currentColor; white-space: nowrap; }
.pb-btn { display: inline-flex; align-items: center; gap: 4px; height: var(--ctl-h); padding: 0 8px; font-size: var(--fs-sm); text-transform: uppercase; border: 1px solid var(--c-line-strong); color: var(--c-text-muted); background: transparent; cursor: pointer; }
.pb-btn:hover { color: var(--c-text); }
.pb-btn--active { color: var(--c-text); background: var(--c-selected); box-shadow: inset 0 -2px 0 var(--c-accent); }
.pb-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: var(--ctl-h); height: var(--ctl-h); border: 1px solid var(--c-line-strong); background: transparent; cursor: pointer; }
.pb-row, .pb-link-row { transition: background var(--t-fast); }
.pb-row:hover, .pb-link-row:hover { background: var(--c-hover); }
.pb-tabbar { display: flex; border-bottom: 1px solid var(--c-line); }
.pb-tab { height: var(--row-h); padding: 0 var(--cell-px); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); background: transparent; border: 0; cursor: pointer; }
.pb-tab:hover { color: var(--c-text); }
.pb-tab--active { color: var(--c-text); box-shadow: inset 0 -2px 0 var(--c-accent); }
.pb-datacell__label { font-size: var(--fs-label); color: var(--c-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.pb-datacell__value { font-size: var(--fs-lg); font-weight: 600; margin-top: 1px; }
.pb-datacell__sub { font-size: var(--fs-sm); color: var(--c-text-dim); }
.pb-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.pb-table th { height: var(--row-h); padding: 0 var(--cell-px); color: var(--c-text-muted); border-bottom: 1px solid var(--c-line); font-size: var(--fs-label); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; text-align: right; }
.pb-table th:first-child { text-align: left; }
.pb-table td { height: var(--row-h); padding: 0 var(--cell-px); text-align: right; white-space: nowrap; }
.pb-table td:first-child { text-align: left; }
.pb-table tbody tr { border-bottom: 1px solid var(--c-line); }
.pb-table tbody tr:last-child { border-bottom: 0; }
.pb-table--hover tbody tr:hover { background: var(--c-hover); }
.pb-overlay { position: fixed; inset: 0; background: var(--c-scrim); }
.pb-dialog { background: var(--c-raised); border: 1px solid var(--c-line-strong); }
.pb-live-dot { display: inline-block; width: 6px; height: 6px; background: var(--c-up); }
/* LEGACY SHELL - deleted in Task 16 with src/components */
.pb-topbar { background: var(--c-bg); border-bottom: 1px solid var(--c-line); }
.pb-sidebar { background: var(--c-bg); border-right: 1px solid var(--c-line); }
.pb-bottombar { background: var(--c-bg); border-top: 1px solid var(--c-line); }
.pb-nav-item { display: flex; align-items: center; gap: 8px; width: 100%; cursor: pointer; }
.pb-nav-item:hover { background: var(--c-hover); }
.pb-nav-item--active { background: var(--c-selected); box-shadow: inset 2px 0 0 var(--c-accent); }
.pb-logo-mark { display: flex; align-items: center; justify-content: center; background: var(--c-accent); }
.pb-search-pill { display: flex; align-items: center; gap: 8px; border: 1px solid var(--c-line-strong); }
```

- [ ] **Step 4: Move the stylesheet import and delete the old file**

Run:
```bash
git rm -q src/index.css
```

Edit `src/main.jsx`: change the line `import "./index.css";` to `import "./theme/index.css";`. The file now reads:

```jsx
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

- [ ] **Step 5: Re-point the legacy JS palette at the new tokens**

In `src/ThemeContext.jsx` replace the `DARK` and `LIGHT` object literals (nothing else in the file changes in this task) with:

```js
const DARK = {
  bg: "#000000",
  bgPanel: "#000000",
  bgCard: "#0d0d0d",
  bgElevated: "#0d0d0d",
  bgInput: "#0d0d0d",
  border: "#222222",
  borderLight: "#3a3a3a",
  purple: "#8b5cf6",
  purpleLight: "#a78bfa",
  purpleActive: "#8b5cf6",
  purpleDark: "#6d28d9",
  purpleDim: "#2e2450",
  green: "#22c55e",
  greenDim: "#14532d",
  red: "#ef4444",
  redDim: "#7f1d1d",
  orange: "#f59e0b",
  orangeDim: "#78350f",
  blue: "#a3a3a3",
  cyan: "#a78bfa",
  text: "#e8e8e8",
  textDim: "#a3a3a3",
  textMuted: "#787878",
  gold: "#e8e8e8",
  white: "#ffffff",
};

const LIGHT = {
  bg: "#f4f4f1",
  bgPanel: "#f4f4f1",
  bgCard: "#ffffff",
  bgElevated: "#ffffff",
  bgInput: "#ffffff",
  border: "#d6d6d0",
  borderLight: "#b8b8b0",
  purple: "#6d28d9",
  purpleLight: "#5b21b6",
  purpleActive: "#6d28d9",
  purpleDark: "#4c1d95",
  purpleDim: "#ede9fe",
  green: "#15803d",
  greenDim: "#dcfce7",
  red: "#dc2626",
  redDim: "#fee2e2",
  orange: "#b45309",
  orangeDim: "#fef3c7",
  blue: "#4a4a4a",
  cyan: "#5b21b6",
  text: "#161616",
  textDim: "#4a4a4a",
  textMuted: "#6e6e6e",
  gold: "#161616",
  white: "#ffffff",
};
```

- [ ] **Step 6: Build to prove nothing broke**

Run:
```bash
npx vite build
```
Expected: the last lines contain `dist/index.html` and `✓ built in` with no error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "theme: Quiet Terminal tokens, IBM Plex Mono, flat legacy stand-ins

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Formatters and ids

**Files:**
- Create: `src/lib/id.js`
- Create: `src/lib/format.js`
- Test: `src/lib/format.test.js`
- Modify: `src/config.js` (replace the UTILITIES block with re-exports)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmt, fmtNum, fmtK, fmtPct, fmtSigned, fmtAgo, fmtCountdown,
  fmtDateTable, fmtAxisDate, fmtTooltipDate, fmtClock,
} from "./format.js";

test("fmt: fixed decimals, em dash for missing", () => {
  assert.equal(fmt(2.5, 1), "2.5");
  assert.equal(fmt(3), "3.00");
  assert.equal(fmt(null), "—");
  assert.equal(fmt(NaN), "—");
  assert.equal(fmt("abc"), "—");
});

test("fmtNum: thousands separators", () => {
  assert.equal(fmtNum(1234567.891, 2), "1,234,567.89");
  assert.equal(fmtNum(42, 0), "42");
  assert.equal(fmtNum(null), "—");
});

test("fmtK: magnitude suffixes including negatives", () => {
  assert.equal(fmtK(1.5e12), "1.50T");
  assert.equal(fmtK(2.5e9), "2.5B");
  assert.equal(fmtK(-3.2e6), "-3.2M");
  assert.equal(fmtK(12_500), "12.5K");
  assert.equal(fmtK(950), "950");
  assert.equal(fmtK(0), "0");
  assert.equal(fmtK(undefined), "—");
});

test("fmtPct and fmtSigned carry an explicit sign", () => {
  assert.equal(fmtPct(1.234), "+1.23%");
  assert.equal(fmtPct(-0.5), "-0.50%");
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtSigned(2.345), "+2.35");
  assert.equal(fmtSigned(-1), "-1.00");
  assert.equal(fmtSigned(0), "0.00");
});

test("fmtAgo: coarse relative age", () => {
  assert.equal(fmtAgo(9_000), "9s");
  assert.equal(fmtAgo(125_000), "2m");
  assert.equal(fmtAgo(3_700_000), "1h");
  assert.equal(fmtAgo(2 * 86_400_000), "2d");
  assert.equal(fmtAgo(-1), "—");
  assert.equal(fmtAgo(null), "—");
});

test("fmtCountdown: h:mm:ss, never negative", () => {
  assert.equal(fmtCountdown(2 * 3_600_000 + 41 * 60_000 + 7_000), "2:41:07");
  assert.equal(fmtCountdown(59_000), "0:00:59");
  assert.equal(fmtCountdown(-5), "0:00:00");
  assert.equal(fmtCountdown(null), "—");
});

test("date formatters", () => {
  assert.equal(fmtDateTable("2026-09-04"), "04 SEP 26");
  assert.equal(fmtDateTable(""), "—");
  assert.equal(fmtDateTable("bad"), "bad");
  assert.equal(fmtAxisDate("2026-03-14"), "Mar 14");
  assert.equal(fmtAxisDate("2026-03-14", true), "Mar '26");
  assert.equal(fmtTooltipDate("2026-03-14"), "Mar 14, 2026");
});

test("fmtClock: 24-hour clock in a given zone", () => {
  const d = new Date(Date.UTC(2026, 8, 4, 14, 18, 53));
  assert.equal(fmtClock(d, "UTC"), "14:18:53");
  assert.equal(fmtClock(d, "Asia/Tokyo"), "23:18:53");
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test src/lib/format.test.js`
Expected: FAIL with `Cannot find module` for `./format.js`.

- [ ] **Step 3: Create `src/lib/id.js`**

```js
// Ids for alerts, transactions, saved screens, toasts. UUIDs where the
// runtime has them, a time-plus-random fallback otherwise.
export function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
```

- [ ] **Step 4: Create `src/lib/format.js`**

```js
// Number, date, and time formatting shared by every screen. Pure, no React.

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const missing = (n) => n == null || n === "" || Number.isNaN(Number(n));

// Fixed decimals, no grouping (tables that must stay narrow).
export const fmt = (n, d = 2) => (missing(n) ? "—" : Number(n).toFixed(d));

// Fixed decimals with thousands separators (prices, headline numbers).
export const fmtNum = (n, d = 2) =>
  missing(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// Magnitude abbreviation. Abbreviates on |n| so negatives collapse too.
export const fmtK = (n) => {
  if (missing(n)) return "—";
  const v = Number(n);
  if (v === 0) return "0";
  const neg = v < 0;
  const a = Math.abs(v);
  let out;
  if (a >= 1e12) out = (a / 1e12).toFixed(2) + "T";
  else if (a >= 1e9) out = (a / 1e9).toFixed(1) + "B";
  else if (a >= 1e6) out = (a / 1e6).toFixed(1) + "M";
  else if (a >= 1e3) out = (a / 1e3).toFixed(1) + "K";
  else out = a.toString();
  return neg ? "-" + out : out;
};

export const fmtSigned = (n, d = 2) => {
  if (missing(n)) return "—";
  const v = Number(n);
  return (v > 0 ? "+" : "") + v.toFixed(d);
};

export const fmtPct = (n, d = 2) => (missing(n) ? "—" : fmtSigned(n, d) + "%");

export const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false });

// "14:18:53" in any IANA zone.
export const fmtClock = (date, timeZone) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

// Coarse age: 9s, 2m, 1h, 2d.
export function fmtAgo(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// h:mm:ss countdown, clamped at zero.
export function fmtCountdown(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Table dates: "2026-09-04" -> "04 SEP 26".
export function fmtDateTable(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const mon = MONTHS_SHORT[Number(m) - 1];
  if (!mon) return iso;
  return `${d} ${mon.toUpperCase()} ${y.slice(-2)}`;
}

// Axis tick: "Mar 14" normally; "Mar '25" when showYear is set (multi-year ranges).
export const fmtAxisDate = (iso, showYear) => {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mon = MONTHS_SHORT[parseInt(m, 10) - 1] || m;
  return showYear ? `${mon} '${y.slice(-2)}` : `${mon} ${parseInt(d, 10)}`;
};

// Tooltip label: full "Mar 14, 2025".
export const fmtTooltipDate = (iso) => {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mon = MONTHS_SHORT[parseInt(m, 10) - 1] || m;
  return `${mon} ${parseInt(d, 10)}, ${y}`;
};
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test src/lib/format.test.js`
Expected: `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 6: Make `config.js` re-export the moved formatters**

In `src/config.js`, delete everything from the line `// ═══════════════════════════════════════════` that precedes `// UTILITIES` down to and including the closing `};` of `fmtTooltipDate` (that is: the `fmt`, `fmtK`, `fmtPct`, `ts`, `MONTHS_SHORT`, `fmtAxisDate`, `fmtTooltipDate` definitions and their comments). In their place insert:

```js
// ═══════════════════════════════════════════
// UTILITIES - moved to src/lib/format.js; re-exported so the
// untouched screens keep importing them from here until P2.
// ═══════════════════════════════════════════
export { fmt, fmtK, fmtPct, ts, MONTHS_SHORT, fmtAxisDate, fmtTooltipDate } from "./lib/format.js";
```

`SECTORS`, the ticker lists, and `IPO_2026` stay exactly as they are.

- [ ] **Step 7: Full test run and build**

Run: `npm test`
Expected: all tests pass (`fail 0`).

Run: `npx vite build`
Expected: `✓ built in` with no error.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "lib: formatters with tests, config re-exports

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Persistent store factory

**Files:**
- Create: `src/stores/createStore.js`
- Create: `src/stores/useStore.js`
- Test: `src/stores/createStore.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/createStore.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryStorage } from "./createStore.js";

test("starts from initial and persists on set", () => {
  const storage = memoryStorage();
  const s = createStore("t1", { a: 1, b: [] }, { storage, debounceMs: 0 });
  assert.deepEqual(s.get(), { a: 1, b: [] });
  s.set({ a: 2, b: [1] });
  assert.equal(storage.getItem("purpleberg.t1"), JSON.stringify({ a: 2, b: [1] }));
});

test("hydrates from storage and fills missing keys from initial", () => {
  const storage = memoryStorage();
  storage.setItem("purpleberg.t2", JSON.stringify({ a: 5 }));
  const s = createStore("t2", { a: 1, c: "x" }, { storage, debounceMs: 0 });
  assert.deepEqual(s.get(), { a: 5, c: "x" });
});

test("ignores corrupt JSON and non-object payloads", () => {
  const storage = memoryStorage();
  storage.setItem("purpleberg.t3", "{nope");
  assert.deepEqual(createStore("t3", { a: 1 }, { storage, debounceMs: 0 }).get(), { a: 1 });
  storage.setItem("purpleberg.t3", "42");
  assert.deepEqual(createStore("t3", { a: 1 }, { storage, debounceMs: 0 }).get(), { a: 1 });
});

test("migrate runs only when nothing usable is stored", () => {
  const storage = memoryStorage();
  storage.setItem("old_key", "light");
  const migrate = (st) => (st.getItem("old_key") ? { theme: st.getItem("old_key") } : null);
  const s = createStore("t4", { theme: "dark" }, { storage, debounceMs: 0, migrate });
  assert.equal(s.get().theme, "light");
  s.set({ theme: "dark" });
  const again = createStore("t4", { theme: "dark" }, { storage, debounceMs: 0, migrate: () => ({ theme: "system" }) });
  assert.equal(again.get().theme, "dark");
});

test("update, subscribe, unsubscribe", () => {
  const s = createStore("t5", { n: 0 }, { storage: null });
  const seen = [];
  const off = s.subscribe((st) => seen.push(st.n));
  s.update((st) => ({ n: st.n + 1 }));
  s.update((st) => ({ n: st.n + 1 }));
  off();
  s.update((st) => ({ n: st.n + 1 }));
  assert.deepEqual(seen, [1, 2]);
  assert.equal(s.get().n, 3);
});

test("reset returns to initial; replace merges over initial", () => {
  const storage = memoryStorage();
  const s = createStore("t6", { a: 1, b: 2 }, { storage, debounceMs: 0 });
  s.set({ a: 9, b: 9 });
  s.reset();
  assert.deepEqual(s.get(), { a: 1, b: 2 });
  assert.equal(storage.getItem("purpleberg.t6"), JSON.stringify({ a: 1, b: 2 }));
  s.replace({ b: 7 });
  assert.deepEqual(s.get(), { a: 1, b: 7 });
});

test("initial is cloned so callers cannot mutate it through the store", () => {
  const initial = { list: [] };
  const s = createStore("t7", initial, { storage: null });
  s.get().list.push(1);
  assert.deepEqual(initial.list, []);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test src/stores/createStore.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/stores/createStore.js`**

```js
// Tiny persistent store: localStorage-backed (guarded), subscribable, and
// synced across tabs through the `storage` event. No React in here so
// node:test can exercise it; the hook lives in useStore.js.
const PREFIX = "purpleberg.";

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

function browserStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* private mode or blocked storage */
  }
  return null;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

export function createStore(key, initial, options = {}) {
  const { migrate = null, debounceMs = 150 } = options;
  const storage = "storage" in options ? options.storage : browserStorage();
  const fullKey = PREFIX + key;
  const listeners = new Set();
  let timer = null;

  function load() {
    let parsed = null;
    try {
      const raw = storage ? storage.getItem(fullKey) : null;
      if (raw != null) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const usable = (v) => v != null && typeof v === "object" && !Array.isArray(v);
    if (!usable(parsed) && migrate) {
      try { parsed = migrate(storage) ?? null; } catch { parsed = null; }
    }
    if (!usable(parsed)) return clone(initial);
    return { ...clone(initial), ...parsed };
  }

  let state = load();

  function persist() {
    if (!storage) return;
    try { storage.setItem(fullKey, JSON.stringify(state)); } catch { /* quota or blocked */ }
  }
  function schedulePersist() {
    if (debounceMs === 0) { persist(); return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; persist(); }, debounceMs);
  }
  function emit() { for (const fn of listeners) fn(state); }
  function set(next) { state = next; schedulePersist(); emit(); }

  const store = {
    key: fullKey,
    get: () => state,
    set,
    update: (fn) => set(fn(state)),
    replace: (next) => { state = { ...clone(initial), ...(next && typeof next === "object" ? next : {}) }; persist(); emit(); },
    reset: () => { state = clone(initial); persist(); emit(); },
    flush: () => { if (timer) { clearTimeout(timer); timer = null; } persist(); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    rehydrate: () => { state = load(); emit(); },
  };

  if (typeof window !== "undefined" && storage && storage === browserStorage()) {
    window.addEventListener("storage", (e) => { if (e.key === fullKey) store.rehydrate(); });
  }
  return store;
}
```

- [ ] **Step 4: Create `src/stores/useStore.js`**

```js
import { useSyncExternalStore } from "react";

const identity = (s) => s;

// Select primitives or references that already exist in state. A selector
// that builds a new object on every call would re-render forever.
export function useStore(store, selector = identity) {
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test src/stores/createStore.test.js`
Expected: `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/stores
git commit -m "stores: persistent store factory with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Domain stores

**Files:**
- Create: `src/stores/settings.js`, `src/stores/ui.js`, `src/stores/watchlist.js`, `src/stores/alerts.js`, `src/stores/savedScreens.js`, `src/stores/portfolio.js`, `src/stores/index.js`
- Test: `src/stores/domain.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/domain.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./createStore.js";
import { migrateSettings, sanitizeSettings, SETTINGS_DEFAULTS } from "./settings.js";
import { addToList, removeFromList, moveInList, normalizeSymbol, WATCHLIST_MAX } from "./watchlist.js";
import { migratePortfolio } from "./portfolio.js";
import { STORES, exportAll, importAll, validateExport, resetAll } from "./index.js";

test("settings migrate from the old purpleberg_theme key", () => {
  const st = memoryStorage();
  assert.equal(migrateSettings(st), null);
  st.setItem("purpleberg_theme", "light");
  assert.deepEqual(migrateSettings(st), { theme: "light" });
  assert.equal(migrateSettings(null), null);
});

test("sanitizeSettings clamps every field to an allowed value", () => {
  assert.deepEqual(sanitizeSettings({}), SETTINGS_DEFAULTS);
  assert.deepEqual(
    sanitizeSettings({ theme: "system", density: "comfortable", refreshSec: 60, defaultScreen: "DES", notifications: true }),
    { theme: "system", density: "comfortable", refreshSec: 60, defaultScreen: "DES", notifications: true }
  );
  assert.equal(sanitizeSettings({ theme: "neon" }).theme, "dark");
  assert.equal(sanitizeSettings({ refreshSec: 7 }).refreshSec, 15);
  assert.equal(sanitizeSettings({ density: "huge" }).density, "compact");
});

test("watchlist list helpers", () => {
  assert.equal(normalizeSymbol(" aapl "), "AAPL");
  assert.equal(normalizeSymbol("brk-b"), "BRK-B");
  assert.equal(normalizeSymbol("^gspc"), "^GSPC");
  assert.equal(normalizeSymbol("bad symbol!"), null);
  assert.deepEqual(addToList(["AAPL"], "msft"), ["AAPL", "MSFT"]);
  assert.deepEqual(addToList(["AAPL"], "aapl"), ["AAPL"]);
  const full = Array.from({ length: WATCHLIST_MAX }, (_, i) => `S${i}`);
  assert.equal(addToList(full, "NEW").length, WATCHLIST_MAX);
  assert.deepEqual(removeFromList(["AAPL", "MSFT"], "aapl"), ["MSFT"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "C", -1), ["A", "C", "B"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "A", -1), ["A", "B", "C"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "C", 1), ["A", "B", "C"]);
});

test("portfolio migrates old holdings into dated buy transactions", () => {
  const st = memoryStorage();
  assert.equal(migratePortfolio(st), null);
  st.setItem("purpleberg_portfolio", JSON.stringify([
    { symbol: "aapl", name: "Apple", shares: 10, avgCost: 150 },
    { symbol: "MSFT", name: "Microsoft", shares: 0, avgCost: 300 },
  ]));
  const out = migratePortfolio(st, new Date(Date.UTC(2026, 8, 4)));
  assert.equal(out.transactions.length, 1);
  const tx = out.transactions[0];
  assert.equal(tx.symbol, "AAPL");
  assert.equal(tx.side, "buy");
  assert.equal(tx.shares, 10);
  assert.equal(tx.price, 150);
  assert.equal(tx.fees, 0);
  assert.equal(tx.date, "2026-09-04");
  assert.equal(tx.note, "imported");
  assert.ok(tx.id);
  st.setItem("purpleberg_portfolio", "not json");
  assert.equal(migratePortfolio(st), null);
});

test("export and import round-trip through every store", () => {
  resetAll();
  STORES.watchlist.set({ symbols: ["NVDA", "AAPL"] });
  STORES.settings.set({ ...SETTINGS_DEFAULTS, theme: "light" });
  const dump = exportAll();
  assert.equal(dump.app, "purpleberg");
  assert.equal(dump.version, 1);
  assert.deepEqual(dump.stores.watchlist, { symbols: ["NVDA", "AAPL"] });
  resetAll();
  assert.equal(STORES.settings.get().theme, "dark");
  const res = importAll(dump);
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(STORES.watchlist.get().symbols, ["NVDA", "AAPL"]);
  assert.equal(STORES.settings.get().theme, "light");
  assert.equal(validateExport({ app: "other" }), "Not a Purpleberg export file");
  assert.equal(validateExport({ app: "purpleberg", stores: { settings: 3 } }), "Invalid section: settings");
  assert.equal(importAll(null).ok, false);
  resetAll();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test src/stores/domain.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/stores/settings.js`**

```js
import { createStore } from "./createStore.js";

export const THEMES = ["dark", "light", "system"];
export const DENSITIES = ["compact", "comfortable"];
export const REFRESH_OPTIONS = [10, 15, 30, 60];

export const SETTINGS_DEFAULTS = {
  theme: "dark",
  density: "compact",
  refreshSec: 15,
  defaultScreen: "WEI",
  notifications: false,
};

// Old versions stored the theme under a bare key.
export function migrateSettings(storage) {
  if (!storage) return null;
  let old = null;
  try { old = storage.getItem("purpleberg_theme"); } catch { return null; }
  if (old === "light" || old === "dark") return { theme: old };
  return null;
}

export function sanitizeSettings(input) {
  const s = input && typeof input === "object" ? input : {};
  return {
    theme: THEMES.includes(s.theme) ? s.theme : SETTINGS_DEFAULTS.theme,
    density: DENSITIES.includes(s.density) ? s.density : SETTINGS_DEFAULTS.density,
    refreshSec: REFRESH_OPTIONS.includes(Number(s.refreshSec)) ? Number(s.refreshSec) : SETTINGS_DEFAULTS.refreshSec,
    defaultScreen: typeof s.defaultScreen === "string" && /^[A-Z]{2,5}$/.test(s.defaultScreen) ? s.defaultScreen : SETTINGS_DEFAULTS.defaultScreen,
    notifications: s.notifications === true,
  };
}

export const settings = createStore("settings", SETTINGS_DEFAULTS, { migrate: migrateSettings });

export function setSetting(key, value) {
  settings.update((s) => sanitizeSettings({ ...s, [key]: value }));
}
```

- [ ] **Step 4: Create `src/stores/ui.js`**

```js
import { createStore } from "./createStore.js";

export const ui = createStore("ui", { sidebarCollapsed: false });

export function toggleSidebar() {
  ui.update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
}
```

- [ ] **Step 5: Create `src/stores/watchlist.js`**

```js
import { createStore } from "./createStore.js";

export const WATCHLIST_MAX = 50;
export const WATCHLIST_DEFAULTS = {
  symbols: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "JPM"],
};

const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

export function normalizeSymbol(s) {
  const t = String(s ?? "").trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

export function addToList(list, symbol) {
  const t = normalizeSymbol(symbol);
  if (!t || list.includes(t) || list.length >= WATCHLIST_MAX) return list;
  return [...list, t];
}

export function removeFromList(list, symbol) {
  const t = String(symbol ?? "").trim().toUpperCase();
  return list.filter((s) => s !== t);
}

export function moveInList(list, symbol, dir) {
  const i = list.indexOf(symbol);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const watchlist = createStore("watchlist", WATCHLIST_DEFAULTS);

export const addSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: addToList(st.symbols, s) }));
export const removeSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: removeFromList(st.symbols, s) }));
export const moveSymbol = (s, dir) => watchlist.update((st) => ({ ...st, symbols: moveInList(st.symbols, s, dir) }));
export const isWatched = (s) => watchlist.get().symbols.includes(String(s ?? "").toUpperCase());
```

- [ ] **Step 6: Create `src/stores/alerts.js`**

```js
import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, symbol, op: "above"|"below", price, baseline, lastPrice,
//           createdAt, triggeredAt, triggeredPrice }]
export const alerts = createStore("alerts", { items: [] });

export function addAlert({ symbol, op, price, baseline }) {
  const base = baseline == null || Number.isNaN(Number(baseline)) ? null : Number(baseline);
  const item = {
    id: newId(),
    symbol: String(symbol).trim().toUpperCase(),
    op: op === "below" ? "below" : "above",
    price: Number(price),
    baseline: base,
    lastPrice: base,
    createdAt: Date.now(),
    triggeredAt: null,
    triggeredPrice: null,
  };
  alerts.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

export function removeAlert(id) {
  alerts.update((s) => ({ ...s, items: s.items.filter((a) => a.id !== id) }));
}

export function rearmAlert(id, baseline) {
  const base = baseline == null ? null : Number(baseline);
  alerts.update((s) => ({
    ...s,
    items: s.items.map((a) =>
      a.id === id ? { ...a, baseline: base, lastPrice: base, triggeredAt: null, triggeredPrice: null } : a
    ),
  }));
}

export function replaceAlertItems(items) {
  alerts.update((s) => ({ ...s, items }));
}
```

- [ ] **Step 7: Create `src/stores/savedScreens.js`**

```js
import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, name, filters }]
export const savedScreens = createStore("savedScreens", { items: [] });

export function saveScreen(name, filters) {
  const item = { id: newId(), name: String(name).trim().slice(0, 40) || "Untitled", filters: { ...filters } };
  savedScreens.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

export function deleteScreen(id) {
  savedScreens.update((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
}
```

- [ ] **Step 8: Create `src/stores/portfolio.js`**

```js
import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// transactions: [{ id, date: "YYYY-MM-DD", symbol, side: "buy"|"sell",
//                  shares, price, fees, note? }]
// The old app stored holdings ({symbol, name, shares, avgCost}) under
// purpleberg_portfolio; each becomes one buy dated on migration day.
export function migratePortfolio(storage, today = new Date()) {
  if (!storage) return null;
  let old = null;
  try { old = JSON.parse(storage.getItem("purpleberg_portfolio") || "null"); } catch { return null; }
  if (!Array.isArray(old) || old.length === 0) return null;
  const date = today.toISOString().slice(0, 10);
  const transactions = old
    .filter((h) => h && h.symbol && Number(h.shares) > 0 && Number(h.avgCost) > 0)
    .map((h) => ({
      id: newId(),
      date,
      symbol: String(h.symbol).toUpperCase(),
      side: "buy",
      shares: Number(h.shares),
      price: Number(h.avgCost),
      fees: 0,
      note: "imported",
    }));
  return transactions.length ? { transactions } : null;
}

export const portfolio = createStore("portfolio", { transactions: [] }, { migrate: migratePortfolio });

export function replaceTransactions(transactions) {
  portfolio.update((s) => ({ ...s, transactions: Array.isArray(transactions) ? transactions : [] }));
}
```

- [ ] **Step 9: Create `src/stores/index.js`**

```js
import { settings, sanitizeSettings } from "./settings.js";
import { ui } from "./ui.js";
import { watchlist } from "./watchlist.js";
import { alerts } from "./alerts.js";
import { savedScreens } from "./savedScreens.js";
import { portfolio } from "./portfolio.js";

export const STORES = { settings, ui, watchlist, alerts, savedScreens, portfolio };
export const EXPORT_VERSION = 1;

export function exportAll() {
  const stores = {};
  for (const [name, store] of Object.entries(STORES)) stores[name] = store.get();
  return { app: "purpleberg", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), stores };
}

export function validateExport(data) {
  if (!data || typeof data !== "object" || data.app !== "purpleberg" || !data.stores || typeof data.stores !== "object") {
    return "Not a Purpleberg export file";
  }
  for (const name of Object.keys(STORES)) {
    if (name in data.stores) {
      const v = data.stores[name];
      if (v == null || typeof v !== "object" || Array.isArray(v)) return `Invalid section: ${name}`;
    }
  }
  return null;
}

export function importAll(data) {
  const error = validateExport(data);
  if (error) return { ok: false, error };
  for (const [name, store] of Object.entries(STORES)) {
    if (!(name in data.stores)) continue;
    store.replace(name === "settings" ? sanitizeSettings(data.stores[name]) : data.stores[name]);
  }
  return { ok: true };
}

export function resetAll() {
  for (const store of Object.values(STORES)) store.reset();
}

export { settings, ui, watchlist, alerts, savedScreens, portfolio };
```

- [ ] **Step 10: Run the tests to see them pass**

Run: `node --test src/stores/domain.test.js`
Expected: `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 11: Commit**

```bash
git add src/stores
git commit -m "stores: settings, ui, watchlist, alerts, saved screens, portfolio with migrations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Theme applier and the legacy ThemeContext bridge

**Files:**
- Create: `src/theme/resolveTheme.js`
- Create: `src/theme/applyTheme.js`
- Create: `src/theme/useResolvedTheme.js`
- Test: `src/theme/resolveTheme.test.js`
- Modify: `src/main.jsx`
- Modify: `src/ThemeContext.jsx` (provider body)

- [ ] **Step 1: Write the failing test**

Create `src/theme/resolveTheme.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, resolveDensity } from "./resolveTheme.js";

test("explicit themes win, system follows the OS", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("garbage", true), "dark");
});

test("density falls back to compact", () => {
  assert.equal(resolveDensity("comfortable"), "comfortable");
  assert.equal(resolveDensity("compact"), "compact");
  assert.equal(resolveDensity(undefined), "compact");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/theme/resolveTheme.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/theme/resolveTheme.js`**

```js
export function resolveTheme(pref, systemDark) {
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system") return systemDark ? "dark" : "light";
  return "dark";
}

export function resolveDensity(pref) {
  return pref === "comfortable" ? "comfortable" : "compact";
}
```

- [ ] **Step 4: Create `src/theme/applyTheme.js`**

```js
import { settings } from "../stores/settings.js";
import { resolveTheme, resolveDensity } from "./resolveTheme.js";

// Drives <html data-theme> and <html data-density> from the settings store
// and the OS preference. Also the source of truth for useResolvedTheme().
const mql = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

const listeners = new Set();
let current = compute();

function compute() {
  const s = settings.get();
  return { theme: resolveTheme(s.theme, mql ? mql.matches : true), density: resolveDensity(s.density) };
}

function paint() {
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.dataset.density = current.density;
}

function refresh() {
  const next = compute();
  if (next.theme === current.theme && next.density === current.density) return;
  current = next;
  paint();
  for (const fn of listeners) fn();
}

export function startThemeSync() {
  paint();
  const unsub = settings.subscribe(refresh);
  if (mql) mql.addEventListener("change", refresh);
  return () => { unsub(); if (mql) mql.removeEventListener("change", refresh); };
}

export function getResolved() { return current; }
export function subscribeResolved(fn) { listeners.add(fn); return () => listeners.delete(fn); }
```

- [ ] **Step 5: Create `src/theme/useResolvedTheme.js`**

```js
import { useSyncExternalStore } from "react";
import { getResolved, subscribeResolved } from "./applyTheme.js";

// "dark" | "light" after system resolution.
export function useResolvedTheme() {
  return useSyncExternalStore(subscribeResolved, getResolved, getResolved).theme;
}

export function useDensity() {
  return useSyncExternalStore(subscribeResolved, getResolved, getResolved).density;
}
```

- [ ] **Step 6: Bridge the legacy ThemeContext to the store**

Replace the whole body of `src/ThemeContext.jsx` below the `LIGHT` object (that is, from `const ThemeContext = createContext();` to the end of the file) with:

```jsx
const ThemeContext = createContext();

// Bridge for the old screens: `useColors()` keeps returning the JS palette and
// `toggle` writes to the settings store. Deleted in P2 with the last old screen.
export function ThemeProvider({ children }) {
  const theme = useResolvedTheme();
  const isDark = theme === "dark";
  const value = useMemo(
    () => ({ colors: isDark ? DARK : LIGHT, isDark, toggle: () => setSetting("theme", isDark ? "light" : "dark") }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
```

and change the import line at the top of the file to:

```jsx
import { createContext, useContext, useMemo } from "react";
import { setSetting } from "./stores/settings.js";
import { useResolvedTheme } from "./theme/useResolvedTheme.js";
```

(`useState` and `useEffect` are no longer used; remove them from the import.)

- [ ] **Step 7: Start the sync in `src/main.jsx`**

```jsx
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { startThemeSync } from "./theme/applyTheme.js";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";

startThemeSync();

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

- [ ] **Step 8: Run tests and build**

Run: `npm test` → `fail 0`.
Run: `npx vite build` → `✓ built in`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "theme: settings-driven theme and density applier, legacy palette bridge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Post-review amendments (applied in the fix commit after Tasks 2-5):** `createStore` gained a `sanitize` option applied on hydrate, replace, and reset, persists a migration immediately, skips `migrate` on cross-tab rehydrate, keeps a pending local write over a foreign one, and flushes on `pagehide` and hidden `visibilitychange`; every domain store passes a sanitizer; `importAll` checks `version` and the required array field of each section before writing anything, and `exportAll` returns a copy; `fmtK` promotes units at band edges; `fmtClock` caches formatters and returns "—" for an unknown zone; `ts()` delegates to `fmtClock`; `migratePortfolio` dates on the local day; `startThemeSync` is a no-op without a DOM and idempotent. Later tasks that read these modules should rely on the code in the repository.

---
### Task 6: Router

**Files:**
- Create: `src/router/match.js`
- Create: `src/router/routes.js`
- Create: `src/router/index.jsx`
- Test: `src/router/match.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/router/match.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPath, matchRoute, parseQuery, buildPath } from "./match.js";
import { ROUTES, routeByMnemonic, routeByName, pathFor, isMnemonic } from "./routes.js";

test("matchPath: static, params, optional params, trailing slash", () => {
  assert.deepEqual(matchPath("/", "/"), {});
  assert.deepEqual(matchPath("/screener", "/screener"), {});
  assert.deepEqual(matchPath("/screener", "/screener/"), {});
  assert.equal(matchPath("/screener", "/screener/x"), null);
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities"), {});
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities/AAPL"), { symbol: "AAPL" });
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities/%5EGSPC"), { symbol: "^GSPC" });
  assert.equal(matchPath("/equities/:symbol?", "/equities/AAPL/extra"), null);
  assert.equal(matchPath("/a/:id", "/a"), null);
});

test("parseQuery decodes and ignores empty input", () => {
  assert.deepEqual(parseQuery("?a=AAPL&b=MSFT&range=3mo"), { a: "AAPL", b: "MSFT", range: "3mo" });
  assert.deepEqual(parseQuery(""), {});
  assert.deepEqual(parseQuery("?q=hello%20world"), { q: "hello world" });
});

test("matchRoute walks the table in order and returns params and query", () => {
  const m = matchRoute(ROUTES, "/equities/%5EGSPC", "?tab=chart");
  assert.equal(m.route.name, "equities");
  assert.deepEqual(m.params, { symbol: "^GSPC" });
  assert.deepEqual(m.query, { tab: "chart" });
  assert.equal(matchRoute(ROUTES, "/", "").route.name, "dashboard");
  assert.equal(matchRoute(ROUTES, "/fx", "").route.name, "fx");
  assert.equal(matchRoute(ROUTES, "/nope", ""), null);
});

test("buildPath encodes params and drops empty query values", () => {
  assert.equal(buildPath("/equities/:symbol?", { symbol: "^GSPC" }), "/equities/%5EGSPC");
  assert.equal(buildPath("/equities/:symbol?", {}), "/equities");
  assert.equal(buildPath("/compare", {}, { a: "AAPL", b: "MSFT", range: "" }), "/compare?a=AAPL&b=MSFT");
  assert.equal(buildPath("/", {}), "/");
  assert.throws(() => buildPath("/x/:id", {}), /missing param id/);
});

test("route table helpers", () => {
  assert.equal(routeByMnemonic("des").name, "equities");
  assert.equal(routeByMnemonic("nope"), null);
  assert.equal(routeByName("rates").mnemonic, "YAS");
  assert.equal(isMnemonic("WEI"), true);
  assert.equal(isMnemonic("eco"), true);
  assert.equal(isMnemonic("AAPL"), false);
  assert.equal(pathFor("equities", { symbol: "CL=F" }), "/equities/CL%3DF");
  assert.equal(pathFor("rates", {}, { tab: "calendar" }), "/rates?tab=calendar");
  assert.equal(ROUTES.length, 12);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/router/match.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/router/match.js`**

```js
// Pure path matching for the in-house router. Patterns look like
// "/equities/:symbol?" - static segments, ":name" params, "?" for optional.

export function compilePattern(pattern) {
  return pattern
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(":")) {
        const optional = seg.endsWith("?");
        return { type: "param", name: seg.slice(1, optional ? -1 : undefined), optional };
      }
      return { type: "static", value: seg };
    });
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function matchPath(pattern, path) {
  const segs = compilePattern(pattern);
  const parts = String(path || "/").split("/").filter(Boolean).map(safeDecode);
  const params = {};
  let i = 0;
  for (const seg of segs) {
    const part = parts[i];
    if (seg.type === "static") {
      if (part !== seg.value) return null;
      i += 1;
    } else if (part !== undefined) {
      params[seg.name] = part;
      i += 1;
    } else if (!seg.optional) {
      return null;
    }
  }
  if (i !== parts.length) return null;
  return params;
}

export function parseQuery(search) {
  const out = {};
  const usp = new URLSearchParams(search || "");
  for (const [k, v] of usp) out[k] = v;
  return out;
}

export function matchRoute(routes, path, search) {
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) return { route, params, query: parseQuery(search) };
  }
  return null;
}

export function buildPath(pattern, params = {}, query = {}) {
  const parts = [];
  for (const seg of compilePattern(pattern)) {
    if (seg.type === "static") {
      parts.push(seg.value);
      continue;
    }
    const v = params[seg.name];
    if (v == null || v === "") {
      if (!seg.optional) throw new Error(`missing param ${seg.name}`);
      continue;
    }
    parts.push(encodeURIComponent(String(v)));
  }
  const qs = Object.entries(query)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return "/" + parts.join("/") + (qs ? "?" + qs : "");
}
```

- [ ] **Step 4: Create `src/router/routes.js`**

```js
import { buildPath } from "./match.js";

// The screen table. `param` names the optional path parameter a mnemonic can
// carry from the command line ("DES AAPL" -> /equities/AAPL).
export const ROUTES = [
  { name: "dashboard", path: "/", mnemonic: "WEI", label: "Dashboard", title: "World equity indices" },
  { name: "equities", path: "/equities/:symbol?", mnemonic: "DES", label: "Equities", title: "Equity analysis", param: "symbol" },
  { name: "screener", path: "/screener", mnemonic: "EQS", label: "Screener", title: "Equity screener" },
  { name: "compare", path: "/compare", mnemonic: "COMP", label: "Compare", title: "Compare two equities" },
  { name: "fx", path: "/fx/:pair?", mnemonic: "WFX", label: "FX", title: "Foreign exchange", param: "pair" },
  { name: "rates", path: "/rates", mnemonic: "YAS", label: "Rates & Macro", title: "Treasury curve and macro calendar" },
  { name: "commodities", path: "/commodities/:symbol?", mnemonic: "CMDT", label: "Commodities", title: "Commodity futures", param: "symbol" },
  { name: "crypto", path: "/crypto/:id?", mnemonic: "CRYP", label: "Crypto", title: "Top 20 cryptocurrencies", param: "id" },
  { name: "ipos", path: "/ipos", mnemonic: "IPO", label: "IPOs", title: "IPO center" },
  { name: "portfolio", path: "/portfolio", mnemonic: "PORT", label: "Portfolio", title: "Portfolio manager" },
  { name: "news", path: "/news", mnemonic: "TOP", label: "News", title: "Market news" },
  { name: "settings", path: "/settings", mnemonic: "SET", label: "Settings", title: "Settings" },
];

// Old mnemonics that still resolve somewhere sensible.
export const ALIASES = {
  ECO: { name: "rates", query: { tab: "calendar" } },
  MARS: { name: "portfolio", query: { tab: "risk" } },
};

export const MOBILE_TAB_NAMES = ["dashboard", "equities", "portfolio", "news"];

const byName = new Map(ROUTES.map((r) => [r.name, r]));
const byMnemonic = new Map(ROUTES.map((r) => [r.mnemonic, r]));

export function routeByName(name) {
  return byName.get(name) || null;
}

export function routeByMnemonic(m) {
  return byMnemonic.get(String(m || "").toUpperCase()) || null;
}

export function isMnemonic(m) {
  const u = String(m || "").toUpperCase();
  return byMnemonic.has(u) || Object.prototype.hasOwnProperty.call(ALIASES, u);
}

export function pathFor(name, params = {}, query = {}) {
  const r = routeByName(name);
  if (!r) throw new Error(`unknown route ${name}`);
  return buildPath(r.path, params, query);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test src/router/match.test.js`
Expected: `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 6: Create `src/router/index.jsx`**

```jsx
import { useMemo, useSyncExternalStore } from "react";
import { matchRoute, parseQuery } from "./match.js";
import { ROUTES } from "./routes.js";

// History API router. One module-level location snapshot, subscribers, and a
// popstate listener. Screens read `useRoute()`; navigation goes through
// `navigate`, `updateQuery`, or <Link>.
const listeners = new Set();

function read() {
  if (typeof window === "undefined") return { path: "/", search: "" };
  return { path: window.location.pathname, search: window.location.search };
}

let snapshot = read();

function emit() {
  snapshot = read();
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") window.addEventListener("popstate", emit);

export function getLocation() {
  return snapshot;
}

export function subscribeLocation(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function navigate(to, { replace = false } = {}) {
  if (to === snapshot.path + snapshot.search) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", to);
  emit();
}

// Merge a patch into the current query string. Null or "" removes a key.
export function updateQuery(patch, { replace = true } = {}) {
  const loc = getLocation();
  const q = parseQuery(loc.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete q[k];
    else q[k] = String(v);
  }
  const qs = new URLSearchParams(q).toString();
  navigate(loc.path + (qs ? "?" + qs : ""), { replace });
}

export function useLocation() {
  return useSyncExternalStore(subscribeLocation, getLocation, getLocation);
}

export function useRoute() {
  const loc = useLocation();
  return useMemo(() => {
    const m = matchRoute(ROUTES, loc.path, loc.search);
    if (m) return { route: m.route, params: m.params, query: m.query, path: loc.path };
    return { route: null, params: {}, query: parseQuery(loc.search), path: loc.path };
  }, [loc]);
}

export function Link({ to, replace = false, onClick, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export { pathFor, ROUTES, ALIASES, routeByName, routeByMnemonic, isMnemonic, MOBILE_TAB_NAMES } from "./routes.js";
export { parseQuery } from "./match.js";
```

- [ ] **Step 7: Commit**

```bash
git add src/router
git commit -m "router: dependency-free history router with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Data layer, quote pool, feed status

**Files:**
- Move: `src/api.js` → `src/data/api.js` (shim left behind)
- Move: `src/hooks.js` → `src/data/hooks.js` (shim left behind)
- Create: `src/data/polling.js`, `src/data/symbols.js`, `src/data/feedState.js`, `src/data/feedStatus.js`, `src/data/poolExtras.js`, `src/data/quotePool.jsx`
- Test: `src/data/data.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/data/data.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleInterval } from "./polling.js";
import { dedupeSymbols, POOL_CAP } from "./symbols.js";
import { nextFeedState, FEED_INITIAL } from "./feedState.js";
import { retainSymbol, releaseSymbol, poolExtras } from "./poolExtras.js";

test("scaleInterval scales by refresh setting with a 5s floor", () => {
  assert.equal(scaleInterval(15000, 15), 15000);
  assert.equal(scaleInterval(15000, 60), 60000);
  assert.equal(scaleInterval(15000, 30), 30000);
  assert.equal(scaleInterval(10000, 10), 6667);
  assert.equal(scaleInterval(5000, 10), 5000);
});

test("dedupeSymbols normalises, validates, dedupes, caps", () => {
  assert.deepEqual(dedupeSymbols([["aapl", "AAPL"], ["msft", " ", "bad symbol!"], "^GSPC", null]), ["AAPL", "MSFT", "^GSPC"]);
  const many = Array.from({ length: POOL_CAP + 50 }, (_, i) => `S${i}`);
  assert.equal(dedupeSymbols([many]).length, POOL_CAP);
});

test("feed state goes offline after two failures and back online on success", () => {
  const t = 1000;
  const one = nextFeedState(FEED_INITIAL, false, t);
  assert.equal(one.status, "online");
  assert.equal(one.failures, 1);
  const two = nextFeedState(one, false, t + 1);
  assert.equal(two.status, "offline");
  assert.equal(two.since, t + 1);
  const three = nextFeedState(two, false, t + 2);
  assert.equal(three.since, t + 1);
  const back = nextFeedState(three, true, t + 3);
  assert.deepEqual(back, { status: "online", failures: 0, since: null });
  assert.equal(nextFeedState(back, true, t + 4), back);
});

test("poolExtras is ref-counted", () => {
  retainSymbol("nvda");
  retainSymbol("NVDA");
  assert.equal(poolExtras.get().counts.NVDA, 2);
  releaseSymbol("NVDA");
  assert.equal(poolExtras.get().counts.NVDA, 1);
  releaseSymbol("NVDA");
  assert.equal("NVDA" in poolExtras.get().counts, false);
  releaseSymbol("NVDA");
  assert.deepEqual(poolExtras.get().counts, {});
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/data/data.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Move the api and hooks modules and leave shims**

Run:
```bash
mkdir -p src/data
git mv src/api.js src/data/api.js
git mv src/hooks.js src/data/hooks.js
```

Create `src/api.js` (shim, one line):
```js
export * from "./data/api.js";
```

Create `src/hooks.js` (shim, one line):
```js
export * from "./data/hooks.js";
```

In `src/data/api.js`, add `status` to the `api` object, after `ipoCalendar`:

```js
  ipoCalendar: () => get("/ipo-calendar"),

  status: () => get("/status"),
};
```

In `src/data/hooks.js`, the first two lines become:

```js
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { useStore } from "../stores/useStore.js";
import { settings } from "../stores/settings.js";
import { scaleInterval } from "./polling.js";
```

- [ ] **Step 4: Create the pure helpers**

`src/data/polling.js`:
```js
// Every poll interval scales with Settings > Data > Refresh (10, 15, 30, 60s),
// relative to the 15s the hooks were tuned for. 5s floor protects the proxy.
export function scaleInterval(baseMs, refreshSec) {
  const factor = (Number(refreshSec) || 15) / 15;
  return Math.max(5000, Math.round(baseMs * factor));
}
```

`src/data/symbols.js`:
```js
export const POOL_CAP = 300; // the proxy's per-request hard cap
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

// Flatten any nesting of arrays and strings into a unique, validated,
// uppercase symbol list in first-seen order.
export function dedupeSymbols(lists) {
  const out = [];
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const s = String(v).trim().toUpperCase();
    if (!TICKER_RE.test(s) || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  walk(lists);
  return out.slice(0, POOL_CAP);
}
```

`src/data/feedState.js`:
```js
export const FEED_INITIAL = { status: "online", failures: 0, since: null };

// Two consecutive failed polls flip the feed offline; one success flips it back.
export function nextFeedState(prev, ok, now = Date.now()) {
  if (ok) {
    if (prev.status === "online" && prev.failures === 0) return prev;
    return { status: "online", failures: 0, since: null };
  }
  const failures = prev.failures + 1;
  if (failures >= 2 && prev.status !== "offline") return { status: "offline", failures, since: now };
  return { ...prev, failures };
}
```

`src/data/feedStatus.js`:
```js
import { createStore } from "../stores/createStore.js";
import { FEED_INITIAL, nextFeedState } from "./feedState.js";

// In-memory only: never persisted, never shared across tabs.
export const feedStatus = createStore("feed", FEED_INITIAL, { storage: null, debounceMs: 0 });

export function reportPoll(ok, now = Date.now()) {
  feedStatus.update((s) => nextFeedState(s, ok, now));
}
```

`src/data/poolExtras.js`:
```js
import { createStore } from "../stores/createStore.js";

// Ad-hoc symbols (quick-look on something outside the tracked 250) held in the
// quote pool for as long as at least one component retains them.
export const poolExtras = createStore("poolExtras", { counts: {} }, { storage: null, debounceMs: 0 });

export function retainSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  if (!s) return;
  poolExtras.update((st) => ({ counts: { ...st.counts, [s]: (st.counts[s] || 0) + 1 } }));
}

export function releaseSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  poolExtras.update((st) => {
    const n = (st.counts[s] || 0) - 1;
    const counts = { ...st.counts };
    if (n <= 0) delete counts[s]; else counts[s] = n;
    return { counts };
  });
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test src/data/data.test.js`
Expected: `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 6: Give the polling hooks `updatedAt`, `error`, `pollSeq`, `refetch`, and interval scaling**

In `src/data/hooks.js` replace the entire `useQuotes` function with:

```js
export function useQuotes(symbols, intervalMs = 15000) {
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [state, setState] = useState({ data: [], loading: true, error: null, updatedAt: null, pollSeq: 0, lastPollOk: null });
  const symbolsKey = symbols.join(",");
  const refetchRef = useRef(null);

  useEffect(() => {
    // No symbols to fetch: clear the loading flag so a caller that starts with
    // an empty list (e.g. an empty portfolio) doesn't hang on "loading" forever.
    if (!symbols.length) { setState((s) => ({ ...s, loading: false })); return undefined; }
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const result = await api.quotes(symbols);
        if (cancelled) return;
        setState((s) => ({
          ...s,
          data: result.length > 0 ? result : s.data, // keep previous rows on an empty payload
          loading: false,
          error: null,
          updatedAt: Date.now(),
          pollSeq: s.pollSeq + 1,
          lastPollOk: true,
        }));
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: e.message, pollSeq: s.pollSeq + 1, lastPollOk: false }));
      }
    };
    refetchRef.current = fetchData;

    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => { if (iv != null) { clearInterval(iv); iv = null; } };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [symbolsKey, effectiveMs]);

  const refetch = useCallback(() => { if (refetchRef.current) refetchRef.current(); }, []);
  return { ...state, refetch, intervalMs: effectiveMs };
}
```

Replace the entire `useNews` function with:

```js
export function useNews(symbols, intervalMs = 120000) {
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [state, setState] = useState({ data: [], loading: true, error: null, updatedAt: null });
  const symbolsKey = symbols ? symbols.join(",") : "";

  useEffect(() => {
    let cancelled = false;
    let iv = null;
    const fetchData = async () => {
      try {
        const result = await api.news(symbols);
        if (!cancelled) setState({ data: result, loading: false, error: null, updatedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }));
      }
    };
    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => { if (iv != null) { clearInterval(iv); iv = null; } };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [symbolsKey, effectiveMs]);

  return { ...state, intervalMs: effectiveMs };
}
```

In `useCryptoMarkets`, change the signature line and the two `setLoading`/`setData` success lines so the hook reports freshness too. The function becomes:

```js
export function useCryptoMarkets(intervalMs = 60000) {
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let iv = null;
    let retryTimer = null;

    // First-load retry: an empty stampede (our own limiter on a page-load
    // burst, or an upstream 429) should not leave the screen empty for a full
    // poll interval. Two short retries before declaring the dashboard empty.
    const fetchData = async (attempt = 0) => {
      try {
        const result = await api.cryptoMarkets();
        if (!cancelled) {
          if (Array.isArray(result) && result.length > 0) setData(result);
          setLoading(false);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        if (attempt < 2) {
          retryTimer = setTimeout(() => fetchData(attempt + 1), 1200 * (attempt + 1));
        } else {
          setLoading(false);
        }
      }
    };

    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => {
      if (iv != null) { clearInterval(iv); iv = null; }
      if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [effectiveMs]);

  return { data, loading, error, updatedAt, intervalMs: effectiveMs };
}
```

In `useHistorical`, add `updatedAt` so the chart toolbar can show freshness: the function becomes

```js
export function useHistorical(symbol, range = "3mo") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!symbol) { setLoading(false); setData([]); return undefined; }
    let cancelled = false;
    setLoading(true);
    api.historical(symbol, range).then((result) => {
      if (!cancelled) { setData(result); setLoading(false); setUpdatedAt(Date.now()); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, range]);

  return { data, loading, updatedAt };
}
```

Everything else in `hooks.js` (`useIsMobile`, `useFinancials`, `useCryptoChart`, `useIpoCalendar`, `useSearch`, `useFinancialsWithRetry`, `usePortfolio`) stays as it is.

- [ ] **Step 7: Create `src/data/quotePool.jsx`**

```jsx
import { createContext, useContext, useEffect, useMemo } from "react";
import { US_STOCKS } from "../config.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { alerts } from "../stores/alerts.js";
import { portfolio } from "../stores/portfolio.js";
import { poolExtras, retainSymbol, releaseSymbol } from "./poolExtras.js";
import { dedupeSymbols, POOL_FIXED } from "./symbols.js";
import { reportPoll } from "./feedStatus.js";
import { useQuotes } from "./hooks.js";

// One poll for everything equity-shaped the app needs: the shell's fixed
// symbols, the user's watchlist, alert and portfolio symbols, ad-hoc extras,
// and finally the tracked 250. User-owned symbols come first so the proxy's
// 300-symbol cap can only ever trim the tail of the static list.
const PoolContext = createContext(null);

export function QuotePoolProvider({ children }) {
  const watch = useStore(watchlist, (s) => s.symbols);
  const alertItems = useStore(alerts, (s) => s.items);
  const txs = useStore(portfolio, (s) => s.transactions);
  const extras = useStore(poolExtras, (s) => s.counts);

  const symbols = useMemo(
    () => dedupeSymbols([POOL_FIXED, watch, alertItems.map((a) => a.symbol), txs.map((t) => t.symbol), Object.keys(extras), US_STOCKS]),
    [watch, alertItems, txs, extras]
  );

  const q = useQuotes(symbols, 15000);

  useEffect(() => {
    if (q.pollSeq > 0) reportPoll(q.lastPollOk);
  }, [q.pollSeq, q.lastPollOk]);

  const bySymbol = useMemo(() => {
    const m = new Map();
    for (const row of q.data) m.set(row.symbol, row);
    return m;
  }, [q.data]);

  // Index rows (^GSPC) are for the shell only; screens read `equities`.
  const equities = useMemo(() => q.data.filter((row) => !String(row.symbol || "").startsWith("^")), [q.data]);

  const value = useMemo(
    () => ({ bySymbol, list: q.data, equities, loading: q.loading, error: q.error, updatedAt: q.updatedAt, intervalMs: q.intervalMs, refetch: q.refetch, symbols }),
    [bySymbol, q.data, equities, q.loading, q.error, q.updatedAt, q.intervalMs, q.refetch, symbols]
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function useQuotePool() {
  const v = useContext(PoolContext);
  if (!v) throw new Error("useQuotePool must be used inside QuotePoolProvider");
  return v;
}

export function useQuote(symbol) {
  const pool = useQuotePool();
  if (!symbol) return null;
  return pool.bySymbol.get(String(symbol).trim().toUpperCase()) ?? null;
}

// Rows for the given symbols, in order, skipping any not yet in the pool.
// Keyed on the joined string so callers may pass a fresh array literal.
export function usePoolQuotes(symbols) {
  const pool = useQuotePool();
  const key = (symbols || []).map((s) => String(s).trim().toUpperCase()).join(",");
  return useMemo(
    () => (key ? key.split(",") : []).map((s) => pool.bySymbol.get(s)).filter(Boolean),
    [pool.bySymbol, key]
  );
}

// Keep an ad-hoc symbol in the pool while the calling component is mounted.
// Joining the pool restarts its poll, so the first price arrives after one
// full round trip; that is the accepted cost of a single shared poll.
export function usePoolExtra(symbol) {
  const sym = symbol ? String(symbol).trim().toUpperCase() : null;
  useEffect(() => {
    if (!sym) return undefined;
    retainSymbol(sym);
    return () => releaseSymbol(sym);
  }, [sym]);
}
```

- [ ] **Step 8: Run everything and build**

Run: `npm test` → `fail 0`.
Run: `npx vite build` → `✓ built in`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "data: quote pool, feed status, interval scaling, freshness on polling hooks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Post-review amendments (applied in the fix commit after Tasks 6-7):** the quote pool orders user-owned symbols before the tracked 250 and exposes `equities` (index rows filtered out) for screens; `useQuotes` treats an empty payload as a failed poll, ignores stale in-flight responses, clears `refetch` on an empty symbol list, and re-paces on a refresh change without an immediate fetch (`useNews` and `useCryptoMarkets` likewise); `usePoolQuotes` keys on the joined uppercase symbols; `POOL_FIXED` lives in `src/data/symbols.js`; `normalizeSymbol` and `TICKER_RE` live in `src/lib/ticker.js`; `buildQuery` is shared by `buildPath` and `updateQuery`; `Link` respects `target`; the `portfolio` store no longer migrates automatically (P3 does it at cutover). Later tasks that read these modules should rely on the code in the repository. A later fix made `useNews` reset on a symbol change and keep previous rows only after its first successful poll, gave `useRepace` a mount guard, and made `nyseSession` return `tableStale`, `nextTradingDay` never return null, and `evaluateAlerts` arm (not fire) on the first price when there is no reference and rewrite `lastPrice` only when the price changes sides.

---

### Task 8: NYSE session clock

**Files:**
- Create: `src/lib/marketHolidays.js`
- Create: `src/lib/session.js`
- Test: `src/lib/session.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/session.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nyseSession, etOffsetMinutes, etInstant, nextTradingDay, isTradingDay, stateFromMarketState } from "./session.js";

const at = (iso) => new Date(iso);
const iso = (d) => d.toISOString();

test("Eastern offset flips with DST", () => {
  assert.equal(etOffsetMinutes(at("2026-07-01T12:00:00Z")), -240);
  assert.equal(etOffsetMinutes(at("2026-01-15T12:00:00Z")), -300);
});

test("etInstant builds the right UTC instant on both sides of DST", () => {
  assert.equal(iso(etInstant("2026-09-04", 9 * 60 + 30)), "2026-09-04T13:30:00.000Z");
  assert.equal(iso(etInstant("2026-11-27", 13 * 60)), "2026-11-27T18:00:00.000Z");
  assert.equal(iso(etInstant("2026-03-09", 9 * 60 + 30)), "2026-03-09T13:30:00.000Z");
  assert.equal(iso(etInstant("2026-11-02", 9 * 60 + 30)), "2026-11-02T14:30:00.000Z");
});

test("trading days skip weekends and holidays", () => {
  assert.equal(isTradingDay("2026-09-04"), true);
  assert.equal(isTradingDay("2026-09-05"), false);
  assert.equal(isTradingDay("2026-09-07"), false); // Labor Day
  assert.equal(nextTradingDay("2026-09-04"), "2026-09-08");
  assert.equal(nextTradingDay("2026-07-02"), "2026-07-06"); // Jul 3 observed holiday, then weekend
});

test("regular session states and countdown targets", () => {
  let s = nyseSession(at("2026-09-04T14:00:00Z")); // Fri 10:00 EDT
  assert.equal(s.state, "open");
  assert.equal(s.countdownLabel, "closes");
  assert.equal(iso(s.countdownTo), "2026-09-04T20:00:00.000Z");

  s = nyseSession(at("2026-09-04T12:00:00Z")); // 08:00 EDT
  assert.equal(s.state, "pre");
  assert.equal(iso(s.countdownTo), "2026-09-04T13:30:00.000Z");

  s = nyseSession(at("2026-09-04T21:00:00Z")); // 17:00 EDT
  assert.equal(s.state, "post");
  assert.equal(s.countdownLabel, "opens");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");

  s = nyseSession(at("2026-09-05T01:00:00Z")); // Fri 21:00 EDT
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");

  s = nyseSession(at("2026-09-04T06:00:00Z")); // Fri 02:00 EDT, before pre-market
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-04T13:30:00.000Z");
});

test("weekends and holidays are closed with the next open as target", () => {
  let s = nyseSession(at("2026-09-05T15:00:00Z")); // Saturday
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");
  s = nyseSession(at("2026-07-03T15:00:00Z")); // Independence Day observed
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-07-06T13:30:00.000Z");
});

test("early close days close at 13:00 ET", () => {
  let s = nyseSession(at("2026-11-27T17:30:00Z")); // 12:30 EST
  assert.equal(s.state, "open");
  assert.equal(s.early, true);
  assert.equal(iso(s.countdownTo), "2026-11-27T18:00:00.000Z");
  s = nyseSession(at("2026-11-27T18:30:00Z")); // 13:30 EST
  assert.equal(s.state, "post");
});

test("DST boundaries", () => {
  assert.equal(nyseSession(at("2026-03-09T13:30:00Z")).state, "open");
  assert.equal(nyseSession(at("2026-03-09T13:29:00Z")).state, "pre");
  assert.equal(nyseSession(at("2026-11-02T14:30:00Z")).state, "open");
  assert.equal(nyseSession(at("2026-11-02T13:30:00Z")).state, "pre");
});

test("Yahoo marketState mapping", () => {
  assert.equal(stateFromMarketState("REGULAR"), "open");
  assert.equal(stateFromMarketState("PRE"), "pre");
  assert.equal(stateFromMarketState("POST"), "post");
  assert.equal(stateFromMarketState("CLOSED"), "closed");
  assert.equal(stateFromMarketState("POSTPOST"), "closed");
  assert.equal(stateFromMarketState(undefined), null);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/lib/session.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/lib/marketHolidays.js`**

```js
// NYSE full-day closures and 13:00 ET early closes. Extend by adding dates.
// Sources: NYSE holiday calendar. Observed dates already applied (e.g. 2026-07-03
// for Independence Day on a Saturday, 2027-12-24 for Christmas on a Saturday).
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

export const NYSE_EARLY_CLOSES = new Set([
  "2026-11-27", "2026-12-24",
  "2027-11-26",
]);
```

- [ ] **Step 4: Create `src/lib/session.js`**

```js
import { NYSE_HOLIDAYS, NYSE_EARLY_CLOSES } from "./marketHolidays.js";

// NYSE session state from wall-clock time. Uses Intl for the New York zone so
// DST needs no tables; holidays and early closes come from marketHolidays.js.
export const ET = "America/New_York";
const PRE_MIN = 4 * 60;
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const EARLY_CLOSE_MIN = 13 * 60;
const POST_END_MIN = 20 * 60;

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Calendar fields of an instant as seen in New York.
export function etParts(date) {
  const p = {};
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

// Minutes to add to UTC to get New York time at this instant (-240 or -300).
export function etOffsetMinutes(date) {
  const p = etParts(date);
  const [y, m, d] = p.ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// The instant at `minutes` past New York midnight on `ymd`. Two passes so the
// offset in force at the target time is used on DST switch days.
export function etInstant(ymd, minutes) {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0);
  const first = new Date(naive - etOffsetMinutes(new Date(naive)) * 60000);
  return new Date(naive - etOffsetMinutes(first) * 60000);
}

export function isTradingDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd !== 0 && wd !== 6 && !NYSE_HOLIDAYS.has(ymd);
}

export function nextTradingDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 14; i += 1) {
    t += 86_400_000;
    const s = new Date(t).toISOString().slice(0, 10);
    if (isTradingDay(s)) return s;
  }
  return null;
}

export function nyseSession(now = new Date()) {
  const p = etParts(now);
  const trading = isTradingDay(p.ymd);
  const early = NYSE_EARLY_CLOSES.has(p.ymd);
  const closeMin = early ? EARLY_CLOSE_MIN : CLOSE_MIN;
  const t = p.hour * 60 + p.minute + p.second / 60;

  let state = "closed";
  if (trading) {
    if (t >= PRE_MIN && t < OPEN_MIN) state = "pre";
    else if (t >= OPEN_MIN && t < closeMin) state = "open";
    else if (t >= closeMin && t < POST_END_MIN) state = "post";
  }

  let countdownTo;
  if (state === "open") countdownTo = etInstant(p.ymd, closeMin);
  else if (state === "pre" || (trading && t < PRE_MIN)) countdownTo = etInstant(p.ymd, OPEN_MIN);
  else countdownTo = etInstant(nextTradingDay(p.ymd), OPEN_MIN);

  return { state, early, ymd: p.ymd, countdownTo, countdownLabel: state === "open" ? "closes" : "opens" };
}

// Yahoo's marketState on ^GSPC, when present, is the ground truth for the label.
export function stateFromMarketState(ms) {
  if (ms === "REGULAR") return "open";
  if (ms === "PRE") return "pre";
  if (ms === "POST") return "post";
  if (typeof ms === "string" && ms) return "closed";
  return null;
}

export const SESSION_LABELS = {
  open: "NYSE OPEN",
  pre: "NYSE PRE-MKT",
  post: "NYSE AFTER HRS",
  closed: "NYSE CLOSED",
};

export const WORLD_CLOCKS = [
  { label: "NEW YORK", tz: "America/New_York" },
  { label: "LONDON", tz: "Europe/London" },
  { label: "TOKYO", tz: "Asia/Tokyo" },
];
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test src/lib/session.test.js`
Expected: `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketHolidays.js src/lib/session.js src/lib/session.test.js
git commit -m "lib: NYSE session clock with holidays, early closes, DST tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Alert evaluation

**Files:**
- Create: `src/lib/alerts.js`
- Test: `src/lib/alerts.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/alerts.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionHolds, evaluateAlerts } from "./alerts.js";

const mk = (over = {}) => ({
  id: "a1", symbol: "NVDA", op: "above", price: 1240, baseline: 1200, lastPrice: 1200,
  createdAt: 1, triggeredAt: null, triggeredPrice: null, ...over,
});
const prices = (map) => (sym) => (sym in map ? map[sym] : null);

test("conditionHolds", () => {
  assert.equal(conditionHolds("above", 1240, 1240), true);
  assert.equal(conditionHolds("above", 1239.99, 1240), false);
  assert.equal(conditionHolds("below", 100, 100), true);
  assert.equal(conditionHolds("below", 100.01, 100), false);
});

test("fires when the price crosses above the target", () => {
  const { fired, next } = evaluateAlerts([mk()], prices({ NVDA: 1241 }), 99);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].triggeredAt, 99);
  assert.equal(fired[0].triggeredPrice, 1241);
  assert.equal(next[0].triggeredAt, 99);
});

test("fires when the price crosses below the target", () => {
  const a = mk({ op: "below", price: 100, baseline: 105, lastPrice: 105 });
  const { fired } = evaluateAlerts([a], prices({ NVDA: 99.5 }), 5);
  assert.equal(fired.length, 1);
});

test("does not fire when the condition already held at the reference price", () => {
  const a = mk({ baseline: 1300, lastPrice: 1300 });
  const { fired, next } = evaluateAlerts([a], prices({ NVDA: 1310 }), 5);
  assert.equal(fired.length, 0);
  assert.equal(next[0].lastPrice, 1310);
});

test("fires after dipping below and coming back above", () => {
  const a = mk({ baseline: 1300, lastPrice: 1300 });
  const step1 = evaluateAlerts([a], prices({ NVDA: 1230 }), 5);
  assert.equal(step1.fired.length, 0);
  const step2 = evaluateAlerts(step1.next, prices({ NVDA: 1245 }), 6);
  assert.equal(step2.fired.length, 1);
});

test("never refires a triggered alert and ignores missing prices", () => {
  const a = mk({ triggeredAt: 1, triggeredPrice: 1250, lastPrice: 1250 });
  const r = evaluateAlerts([a, mk({ id: "a2", symbol: "ZZZZ" })], prices({ NVDA: 1300 }), 7);
  assert.equal(r.fired.length, 0);
  assert.equal(r.next, r.next); // sanity
});

test("returns the same array when nothing changed", () => {
  const items = [mk({ lastPrice: 1210 })];
  const r = evaluateAlerts(items, prices({ NVDA: 1210 }), 8);
  assert.equal(r.next, items);
  assert.equal(r.fired.length, 0);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/lib/alerts.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/lib/alerts.js`**

```js
// Alert evaluation. An alert fires when its condition holds for the current
// price and did not hold for the reference price: the last price we recorded
// on the other side of the threshold, or the baseline captured at creation or
// re-arm. That is crossing semantics: an alert created while already above its
// target waits for a dip and a return. The reference is only rewritten when
// the price changes sides, so a quiet poll leaves the store untouched.

export function conditionHolds(op, price, target) {
  return op === "below" ? price <= target : price >= target;
}

const usable = (price) => Number.isFinite(price) && price > 0;

// items: alert store items. getPrice: (symbol) => number | null.
// Returns { fired, next }; `next` is the same array when nothing changed.
export function evaluateAlerts(items, getPrice, now = Date.now()) {
  const fired = [];
  let changed = false;
  const next = items.map((a) => {
    const price = getPrice(a.symbol);
    if (!usable(price) || a.triggeredAt != null) return a;
    const ref = a.lastPrice ?? a.baseline;
    if (ref == null) {
      // No reference yet (created without a live quote): arm on this price.
      changed = true;
      return { ...a, lastPrice: price };
    }
    const holdsNow = conditionHolds(a.op, price, a.price);
    const heldBefore = conditionHolds(a.op, ref, a.price);
    if (holdsNow && !heldBefore) {
      changed = true;
      const t = { ...a, triggeredAt: now, triggeredPrice: price, lastPrice: price };
      fired.push(t);
      return t;
    }
    if (holdsNow !== heldBefore) {
      // Crossed back to the far side: remember it so the next return fires.
      changed = true;
      return { ...a, lastPrice: price };
    }
    return a;
  });
  return { fired, next: changed ? next : items };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test src/lib/alerts.test.js`
Expected: `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alerts.js src/lib/alerts.test.js
git commit -m "lib: alert crossing evaluation with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 10: Kit part A, static primitives

**Files:**
- Create: `src/ui/useNow.js`, `src/ui/sparklinePath.js`, `src/ui/freshness.js`
- Create: `src/ui/Section.jsx`, `src/ui/Grid.jsx`, `src/ui/Stat.jsx`, `src/ui/KV.jsx`, `src/ui/Change.jsx`, `src/ui/Price.jsx`, `src/ui/Tag.jsx`, `src/ui/Button.jsx`, `src/ui/Input.jsx`, `src/ui/Select.jsx`, `src/ui/Kbd.jsx`, `src/ui/Segmented.jsx`, `src/ui/Tabs.jsx`, `src/ui/EmptyState.jsx`, `src/ui/Loading.jsx`, `src/ui/Skeleton.jsx`, `src/ui/Sparkline.jsx`, `src/ui/Freshness.jsx`
- Test: `src/ui/kit.test.js`
- Modify: `src/theme/index.css` (append the "Kit A" block before the LEGACY block)

- [ ] **Step 1: Write the failing tests**

Create `src/ui/kit.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklinePoints } from "./sparklinePath.js";
import { freshnessState } from "./freshness.js";

test("sparklinePoints scales values into the box, centres flat lines, skips junk", () => {
  assert.equal(sparklinePoints([1, 2, 3], 60, 14, 1), "1.0,13.0 30.0,7.0 59.0,1.0");
  assert.equal(sparklinePoints([5, 5], 60, 14, 1), "1.0,7.0 59.0,7.0");
  assert.equal(sparklinePoints([1], 60, 14), "");
  assert.equal(sparklinePoints([1, null, "x", 3], 60, 14, 1), "1.0,13.0 59.0,1.0");
  assert.equal(sparklinePoints(null, 60, 14), "");
});

test("freshnessState labels and staleness", () => {
  const now = 100_000;
  assert.deepEqual(freshnessState(null, now, 15000, true), { label: "LOADING…", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 9000, now, 15000, true), { label: "9s ago", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 50_000, now, 15000, true), { label: "STALE 50s", tone: "warn", stale: true });
  assert.deepEqual(freshnessState(now - 100_000, now, 60000, true), { label: "1m ago", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 9000, now, 15000, false), { label: "OFFLINE", tone: "warn", stale: true });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/ui/kit.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the pure helpers**

`src/ui/sparklinePath.js`:
```js
// SVG polyline points for a tiny inline chart. Flat series sit on the middle line.
export function sparklinePoints(values, width, height, pad = 1) {
  const v = (Array.isArray(values) ? values : []).filter((n) => typeof n === "number" && Number.isFinite(n));
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min;
  const stepX = (width - pad * 2) / (v.length - 1);
  const yOf = span === 0 ? () => height / 2 : (n) => height - pad - ((n - min) / span) * (height - pad * 2);
  return v.map((n, i) => `${(pad + i * stepX).toFixed(1)},${yOf(n).toFixed(1)}`).join(" ");
}
```

`src/ui/freshness.js`:
```js
import { fmtAgo } from "../lib/format.js";

// "9s ago" while fresh; amber "STALE 2m" once older than 3 polls (45s floor);
// "OFFLINE" whenever the feed status says the proxy stopped answering.
export function freshnessState(updatedAt, now, intervalMs = 15000, online = true) {
  if (!online) return { label: "OFFLINE", tone: "warn", stale: true };
  if (!updatedAt) return { label: "LOADING…", tone: "muted", stale: false };
  const age = Math.max(0, now - updatedAt);
  const stale = age > Math.max(3 * intervalMs, 45_000);
  if (stale) return { label: `STALE ${fmtAgo(age)}`, tone: "warn", stale: true };
  return { label: `${fmtAgo(age)} ago`, tone: "muted", stale: false };
}
```

`src/ui/useNow.js`:
```js
import { useSyncExternalStore } from "react";

// One shared 1s ticker for every clock, countdown, and freshness label.
let now = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  now = Date.now();
  for (const fn of listeners) fn();
}

function subscribe(fn) {
  listeners.add(fn);
  if (!timer) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}

const get = () => now;

export function useNow() {
  return useSyncExternalStore(subscribe, get, get);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test src/ui/kit.test.js`
Expected: `ℹ pass 2`, `ℹ fail 0`.

- [ ] **Step 5: Create the components**

`src/ui/Section.jsx`:
```jsx
import { useIsMobile } from "../data/hooks.js";

// A hairline-bordered region with an uppercase accent title. Inside a <Grid>
// the grid supplies the hairlines; `span` spreads it across columns on desktop.
export function Section({ title, mnemonic, meta, actions, flush = false, span, id, className = "", style, children }) {
  const isMobile = useIsMobile(768);
  const gridStyle = span && !isMobile ? { gridColumn: span === "all" ? "1 / -1" : `span ${span}` } : undefined;
  const hasHead = Boolean(title || meta || actions);
  return (
    <section id={id} className={`pb-section${flush ? " pb-section--flush" : ""}${className ? " " + className : ""}`} style={{ ...gridStyle, ...style }}>
      {hasHead && (
        <header className="pb-section__head">
          {title && (
            <h2 className="pb-section__title">
              {mnemonic && <span className="pb-section__mn">{mnemonic}</span>}
              {title}
            </h2>
          )}
          {meta && <div className="pb-section__meta">{meta}</div>}
          {actions && <div className="pb-section__actions">{actions}</div>}
        </header>
      )}
      <div className="pb-section__body">{children}</div>
    </section>
  );
}
```

`src/ui/Grid.jsx`:
```jsx
import { useIsMobile } from "../data/hooks.js";

// Hairline grid: 1px gaps painted by the container background.
export function Grid({ cols = "1fr", colsTablet, colsMobile = "1fr", className = "", style, children }) {
  const isMobile = useIsMobile(768);
  const isTablet = useIsMobile(1024);
  const template = isMobile ? colsMobile : isTablet ? colsTablet || cols : cols;
  return (
    <div className={`pb-grid${className ? " " + className : ""}`} style={{ gridTemplateColumns: template, ...style }}>
      {children}
    </div>
  );
}

// Screen root: stacks grids and sections with a hairline between them.
export function Page({ className = "", children }) {
  return <div className={`pb-page${className ? " " + className : ""}`}>{children}</div>;
}
```

`src/ui/Stat.jsx`:
```jsx
// Label over a value. `tone` is "up" | "down" | "warn" | "accent".
export function Stat({ label, value, sub, tone, align = "left", size = "md", className = "" }) {
  return (
    <div className={`pb-stat pb-stat--${align} pb-stat--${size}${className ? " " + className : ""}`}>
      <div className="pb-stat__label">{label}</div>
      <div className={`pb-stat__value${tone ? ` pb-${tone}` : ""}`}>{value}</div>
      {sub != null && sub !== "" && <div className="pb-stat__sub">{sub}</div>}
    </div>
  );
}

export function StatRow({ cols, className = "", children }) {
  return (
    <div className={`pb-statrow${className ? " " + className : ""}`} style={cols ? { gridTemplateColumns: cols } : undefined}>
      {children}
    </div>
  );
}
```

`src/ui/KV.jsx`:
```jsx
// Key-value row. Keys are uppercase muted labels, values right-aligned.
export function KV({ k, v, tone, title }) {
  return (
    <div className="pb-kv" title={title}>
      <span className="pb-kv__k">{k}</span>
      <span className={`pb-kv__v${tone ? ` pb-${tone}` : ""}`}>{v}</span>
    </div>
  );
}

export function KVList({ cols = 1, className = "", children }) {
  return (
    <div className={`pb-kvlist${className ? " " + className : ""}`} style={cols > 1 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  );
}
```

`src/ui/Change.jsx`:
```jsx
// Signed, coloured change. Replaces the old ChgVal.
export function Change({ value, suffix = "%", decimals = 2, arrow = false, className = "" }) {
  if (value == null || value === "" || Number.isNaN(Number(value))) {
    return <span className={`pb-muted${className ? " " + className : ""}`}>—</span>;
  }
  const v = Object.is(Number(value), -0) ? 0 : Number(value);
  const tone = v > 0 ? "pb-up" : v < 0 ? "pb-down" : "pb-dim";
  const glyph = arrow ? (v > 0 ? "▲ " : v < 0 ? "▼ " : "") : "";
  return (
    <span className={`pb-change ${tone}${className ? " " + className : ""}`}>
      {glyph}{v > 0 ? "+" : ""}{v.toFixed(decimals)}{suffix}
    </span>
  );
}
```

`src/ui/Price.jsx`:
```jsx
import { useEffect, useRef, useState } from "react";

// A value that flashes green or red for one animation cycle when it changes.
export function Price({ value, format, className = "", style }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (prev.current != null && value != null && !Number.isNaN(value) && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
    }
    prev.current = value;
  }, [value]);
  return (
    <span className={`pb-price${flash ? ` pb-flash-${flash}` : ""}${className ? " " + className : ""}`} style={style} onAnimationEnd={() => setFlash(null)}>
      {format ? format(value) : value}
    </span>
  );
}
```

`src/ui/Tag.jsx`:
```jsx
// Square outline label: exchange, market state, IPO status, impact.
export function Tag({ tone, title, className = "", children }) {
  return (
    <span className={`pb-tag${tone ? ` pb-tag--${tone}` : ""}${className ? " " + className : ""}`} title={title}>
      {children}
    </span>
  );
}
```

`src/ui/Button.jsx`:
```jsx
import { forwardRef } from "react";

export const Button = forwardRef(function Button(
  { variant = "ghost", size = "md", type = "button", className = "", children, ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} className={`pb-button pb-button--${variant} pb-button--${size}${className ? " " + className : ""}`} {...rest}>
      {children}
    </button>
  );
});

export function IconButton({ label, className = "", children, ...rest }) {
  return (
    <button type="button" className={`pb-iconbtn${className ? " " + className : ""}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
```

`src/ui/Input.jsx`:
```jsx
import { forwardRef } from "react";

export const Input = forwardRef(function Input({ mono = false, className = "", ...rest }, ref) {
  return <input ref={ref} className={`pb-input${mono ? " pb-input--mono" : ""}${className ? " " + className : ""}`} {...rest} />;
});
```

`src/ui/Select.jsx`:
```jsx
// options: [{ value, label }]
export function Select({ options, value, onChange, className = "", ...rest }) {
  return (
    <select className={`pb-select${className ? " " + className : ""}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
```

`src/ui/Kbd.jsx`:
```jsx
export function Kbd({ children }) {
  return <kbd className="pb-kbd">{children}</kbd>;
}
```

`src/ui/Segmented.jsx`:
```jsx
// options: [{ value, label, disabled? }]
export function Segmented({ options, value, onChange, label, size = "md", className = "" }) {
  return (
    <div className={`pb-seg pb-seg--${size}${className ? " " + className : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pb-seg__btn${o.value === value ? " pb-seg__btn--on" : ""}`}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`src/ui/Tabs.jsx`:
```jsx
// tabs: string[] or [{ value, label }]
export function Tabs({ tabs, active, onChange, label, className = "" }) {
  return (
    <div className={`pb-tabs${className ? " " + className : ""}`} role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const tab = typeof t === "string" ? { value: t, label: t } : t;
        const on = tab.value === active;
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={on} className={`pb-tabs__tab${on ? " pb-tabs__tab--on" : ""}`} onClick={() => onChange(tab.value)}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

`src/ui/EmptyState.jsx`:
```jsx
export function EmptyState({ action, className = "", children }) {
  return (
    <div className={`pb-empty${className ? " " + className : ""}`}>
      <div className="pb-empty__msg">{children}</div>
      {action && <div className="pb-empty__action">{action}</div>}
    </div>
  );
}
```

`src/ui/Loading.jsx`:
```jsx
// Text, never a spinner.
export function Loading({ text = "LOADING…", className = "" }) {
  return <div className={`pb-loading${className ? " " + className : ""}`} role="status">{text}</div>;
}
```

`src/ui/Skeleton.jsx`:
```jsx
// Plain placeholder lines for tables and charts while data loads.
export function Skeleton({ rows = 6, className = "" }) {
  return (
    <div className={`pb-skel${className ? " " + className : ""}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="pb-skel__row" />)}
    </div>
  );
}
```

`src/ui/Sparkline.jsx`:
```jsx
import { sparklinePoints } from "./sparklinePath.js";

export function Sparkline({ values, width = 60, height = 14, className = "" }) {
  const points = sparklinePoints(values, width, height, 1);
  if (!points) return <span className={`pb-spark pb-spark--empty${className ? " " + className : ""}`} style={{ width, height }} aria-hidden="true" />;
  const first = values.find((n) => Number.isFinite(n));
  const last = [...values].reverse().find((n) => Number.isFinite(n));
  const tone = last > first ? "pb-up" : last < first ? "pb-down" : "pb-dim";
  return (
    <svg className={`pb-spark ${tone}${className ? " " + className : ""}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

`src/ui/Freshness.jsx`:
```jsx
import { useNow } from "./useNow.js";
import { useStore } from "../stores/useStore.js";
import { feedStatus } from "../data/feedStatus.js";
import { freshnessState } from "./freshness.js";

export function Freshness({ updatedAt, intervalMs = 15000, className = "" }) {
  const now = useNow();
  const online = useStore(feedStatus, (s) => s.status === "online");
  const f = freshnessState(updatedAt, now, intervalMs, online);
  return <span className={`pb-fresh pb-${f.tone}${className ? " " + className : ""}`}>{f.label}</span>;
}
```

- [ ] **Step 6: Append the Kit A styles**

Insert the following block into `src/theme/index.css` immediately before the line `/* ============================================================` that starts the `LEGACY` section:

```css
/* ============================================================
   Kit A - layout and static primitives
   ============================================================ */
.pb-page { display: flex; flex-direction: column; gap: 1px; background: var(--c-line); min-height: 100%; }
.pb-page > * { background: var(--c-bg); }
.pb-grid { display: grid; gap: 1px; background: var(--c-line); align-items: stretch; }
.pb-grid > * { min-width: 0; background: var(--c-bg); }

.pb-section { display: flex; flex-direction: column; min-width: 0; background: var(--c-bg); }
.pb-section__head { display: flex; align-items: center; gap: var(--cell-px); min-height: var(--row-h); padding: 0 var(--cell-px); border-bottom: 1px solid var(--c-line); }
.pb-section__title { font-size: var(--fs-label); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-section__mn { margin-right: 1ch; }
.pb-section__meta { margin-left: auto; font-size: var(--fs-label); color: var(--c-text-muted); white-space: nowrap; }
.pb-section__actions { display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.pb-section__body { padding: var(--sec-pad); min-width: 0; flex: 1; }
.pb-section--flush > .pb-section__body { padding: 0; }

.pb-statrow { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 1px; background: var(--c-line); border-bottom: 1px solid var(--c-line); }
.pb-statrow > .pb-stat { background: var(--c-bg); padding: var(--cell-py) var(--cell-px); min-width: 0; }
.pb-stat__label { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); white-space: nowrap; }
.pb-stat__value { font-size: var(--fs-lg); font-weight: 600; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-stat--lg .pb-stat__value { font-size: var(--fs-xl); }
.pb-stat__sub { font-size: var(--fs-sm); color: var(--c-text-dim); }
.pb-stat--right { text-align: right; }

.pb-kvlist { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--cell-px); }
.pb-kv { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: var(--row-h); padding: 0 var(--cell-px); border-bottom: 1px solid var(--c-line); min-width: 0; }
.pb-kv__k { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-muted); white-space: nowrap; }
.pb-kv__v { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pb-change { white-space: nowrap; }
.pb-price { white-space: nowrap; }

.pb-tag { display: inline-flex; align-items: center; height: 16px; padding: 0 4px; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-dim); border: 1px solid var(--c-line-strong); white-space: nowrap; line-height: 1; }
.pb-tag--up { color: var(--c-up); border-color: var(--c-up); }
.pb-tag--down { color: var(--c-down); border-color: var(--c-down); }
.pb-tag--warn { color: var(--c-warn); border-color: var(--c-warn); }
.pb-tag--accent { color: var(--c-accent-text); border-color: var(--c-accent); }

.pb-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: var(--ctl-h); padding: 0 10px; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--c-line-strong); color: var(--c-text); background: transparent; white-space: nowrap; transition: background var(--t-fast), border-color var(--t-fast); }
.pb-button:hover { background: var(--c-hover); border-color: var(--c-text-muted); }
.pb-button--primary { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-on-accent); }
.pb-button--primary:hover { background: var(--c-accent); filter: brightness(1.12); }
.pb-button--danger { color: var(--c-down); border-color: var(--c-down); }
.pb-button--sm { height: 20px; padding: 0 6px; font-size: var(--fs-xs); }
.pb-button:disabled { opacity: 0.45; cursor: not-allowed; }
.pb-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: var(--ctl-h); height: var(--ctl-h); color: var(--c-text-muted); border: 1px solid transparent; }
.pb-iconbtn:hover { color: var(--c-text); border-color: var(--c-line-strong); }

.pb-input, .pb-select { height: var(--ctl-h); padding: 0 8px; border: 1px solid var(--c-line-strong); background: var(--c-raised); color: var(--c-text); font-size: var(--fs-sm); width: 100%; min-width: 0; }
.pb-input:focus, .pb-select:focus { border-color: var(--c-accent); }
.pb-input--mono { text-transform: uppercase; letter-spacing: 0.04em; }
.pb-select { appearance: auto; padding-right: 4px; }
.pb-kbd { display: inline-block; padding: 0 4px; font-size: var(--fs-xs); line-height: 16px; border: 1px solid var(--c-line-strong); color: var(--c-text-dim); }

.pb-seg { display: inline-flex; border: 1px solid var(--c-line-strong); }
.pb-seg__btn { height: calc(var(--ctl-h) - 2px); padding: 0 8px; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-muted); border-right: 1px solid var(--c-line-strong); white-space: nowrap; }
.pb-seg__btn:last-child { border-right: 0; }
.pb-seg__btn:hover { color: var(--c-text); }
.pb-seg__btn--on { color: var(--c-text); background: var(--c-selected); box-shadow: inset 0 -2px 0 var(--c-accent); }
.pb-seg__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pb-seg--sm .pb-seg__btn { height: 18px; padding: 0 6px; font-size: var(--fs-xs); }

.pb-tabs { display: flex; border-bottom: 1px solid var(--c-line); overflow-x: auto; }
.pb-tabs__tab { height: var(--row-h); padding: 0 var(--cell-px); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); white-space: nowrap; }
.pb-tabs__tab:hover { color: var(--c-text); }
.pb-tabs__tab--on { color: var(--c-text); box-shadow: inset 0 -2px 0 var(--c-accent); }

.pb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px var(--cell-px); color: var(--c-text-muted); text-align: center; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.04em; }
.pb-loading { padding: 16px var(--cell-px); color: var(--c-text-muted); font-size: var(--fs-sm); letter-spacing: 0.06em; }
.pb-skel { padding: var(--cell-py) var(--cell-px); }
.pb-skel__row { height: calc(var(--row-h) - 10px); margin: 5px 0; background: var(--c-line); opacity: 0.6; }
.pb-skel__row:nth-child(2n) { width: 85%; }
.pb-skel__row:nth-child(3n) { width: 70%; }

.pb-spark { display: inline-block; vertical-align: middle; }
.pb-spark--empty { display: inline-block; }
.pb-fresh { font-size: var(--fs-label); letter-spacing: 0.04em; white-space: nowrap; }
```

- [ ] **Step 7: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "ui: kit primitives (section, grid, stat, kv, change, price, tag, controls, freshness, sparkline)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Kit part B, DataTable

**Files:**
- Create: `src/ui/tableUtils.js`
- Create: `src/ui/DataTable.jsx`
- Test: `src/ui/tableUtils.test.js`
- Modify: `src/theme/index.css` (append "Kit B" block before LEGACY)

- [ ] **Step 1: Write the failing tests**

Create `src/ui/tableUtils.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRows, visibleWindow, digitIndex } from "./tableUtils.js";

const cols = [{ key: "sym" }, { key: "px" }, { key: "name", sortValue: (r) => r.name.toLowerCase() }];
const rows = [
  { sym: "B", px: 2, name: "beta" },
  { sym: "A", px: null, name: "Alpha" },
  { sym: "C", px: 1, name: "gamma" },
  { sym: "D", px: 2, name: "delta" },
];
const syms = (list) => list.map((r) => r.sym);

test("sortRows: numeric desc and asc, stable, missing values last either way", () => {
  assert.deepEqual(syms(sortRows(rows, cols, { key: "px", dir: "desc" })), ["B", "D", "C", "A"]);
  assert.deepEqual(syms(sortRows(rows, cols, { key: "px", dir: "asc" })), ["C", "B", "D", "A"]);
});

test("sortRows: strings through sortValue, case-insensitive", () => {
  assert.deepEqual(syms(sortRows(rows, cols, { key: "name", dir: "asc" })), ["A", "B", "D", "C"]);
});

test("sortRows: no sort or unknown key returns the input array itself", () => {
  assert.equal(sortRows(rows, cols, null), rows);
  assert.equal(sortRows(rows, cols, { key: "nope", dir: "asc" }), rows);
});

test("visibleWindow", () => {
  assert.deepEqual(visibleWindow(0, 24, 1000, 480, 8), { start: 0, end: 28 });
  assert.deepEqual(visibleWindow(2400, 24, 1000, 480, 8), { start: 92, end: 128 });
  assert.deepEqual(visibleWindow(999_999, 24, 50, 480, 8), { start: 50, end: 50 });
  assert.deepEqual(visibleWindow(0, 24, 10, 480, 8), { start: 0, end: 10 });
});

test("digitIndex maps 1-9 to 0-8", () => {
  assert.equal(digitIndex("1"), 0);
  assert.equal(digitIndex("9"), 8);
  assert.equal(digitIndex("0"), -1);
  assert.equal(digitIndex("a"), -1);
  assert.equal(digitIndex("Enter"), -1);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/ui/tableUtils.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create `src/ui/tableUtils.js`**

```js
// Pure helpers behind DataTable.

const isMissing = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base", numeric: true });
}

// Stable sort by one column. Missing values always sink to the bottom.
export function sortRows(rows, columns, sort) {
  if (!sort || !sort.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  const value = col.sortValue || ((row) => row[col.key]);
  return rows
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((x, y) => {
      const xm = isMissing(x.v);
      const ym = isMissing(y.v);
      if (xm || ym) return xm && ym ? x.i - y.i : xm ? 1 : -1;
      const c = compareValues(x.v, y.v);
      return c !== 0 ? c * dir : x.i - y.i;
    })
    .map((x) => x.row);
}

// Row window for fixed-height virtualisation.
export function visibleWindow(scrollTop, rowH, total, viewportH, overscan = 8) {
  const first = Math.floor(scrollTop / rowH);
  const last = Math.ceil((scrollTop + viewportH) / rowH);
  const start = Math.min(total, Math.max(0, first - overscan));
  const end = Math.min(total, last + overscan);
  return { start, end: Math.max(start, end) };
}

// "1".."9" -> 0..8, anything else -> -1.
export function digitIndex(key) {
  if (typeof key !== "string" || key.length !== 1) return -1;
  const n = key.charCodeAt(0) - 49;
  return n >= 0 && n <= 8 ? n : -1;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test src/ui/tableUtils.test.js`
Expected: `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Create `src/ui/DataTable.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { sortRows, visibleWindow, digitIndex } from "./tableUtils.js";
import { Skeleton } from "./Skeleton.jsx";
import { EmptyState } from "./EmptyState.jsx";

function rowHeightPx() {
  if (typeof window === "undefined") return 24;
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-h"), 10);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

// columns: [{ key, label, align?: "left"|"right", width?, sortable?, sortValue?(row), render?(row, i) }]
// sort: { key, dir: "asc"|"desc" } | null
export function DataTable({
  columns, rows, rowKey, sort = null, onSort, selectedKey, onRowClick, onRowSpace,
  navigable = false, numbered = false, virtualize = false, height = 480,
  loading = false, empty = "NO DATA", skeletonRows = 8, label, className = "",
}) {
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const keyOf = (row, i) => (rowKey ? rowKey(row) : i);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);
  const rowH = rowHeightPx();
  const win = virtualize ? visibleWindow(scrollTop, rowH, sorted.length, height, 8) : { start: 0, end: sorted.length };
  const slice = sorted.slice(win.start, win.end);

  useEffect(() => {
    if (focusIdx >= sorted.length) setFocusIdx(sorted.length ? sorted.length - 1 : -1);
  }, [sorted.length, focusIdx]);

  // After a keyboard move the target row may only exist after re-render (virtualised).
  useEffect(() => {
    if (!navigable || focusIdx < 0 || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-row-index="${focusIdx}"]`);
    if (el && document.activeElement !== el && scrollRef.current.contains(document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  }, [focusIdx, win.start, navigable]);

  const ensureVisible = (idx) => {
    const s = scrollRef.current;
    if (!s) return;
    if (virtualize) {
      const top = idx * rowH;
      const bottom = top + rowH;
      if (top < s.scrollTop) s.scrollTop = top;
      else if (bottom > s.scrollTop + s.clientHeight) s.scrollTop = bottom - s.clientHeight;
      setScrollTop(s.scrollTop);
    } else {
      const el = s.querySelector(`[data-row-index="${idx}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  };

  const onKeyDown = (e) => {
    if (!navigable || !sorted.length) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const page = Math.max(1, Math.floor(height / rowH) - 1);
    let next = null;
    if (e.key === "ArrowDown") next = Math.min(sorted.length - 1, focusIdx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, focusIdx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sorted.length - 1;
    else if (e.key === "PageDown") next = Math.min(sorted.length - 1, focusIdx + page);
    else if (e.key === "PageUp") next = Math.max(0, focusIdx - page);
    else if (e.key === "Enter" && focusIdx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowClick) onRowClick(sorted[focusIdx], focusIdx);
      return;
    } else if (e.key === " " && focusIdx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowSpace) onRowSpace(sorted[focusIdx], focusIdx);
      return;
    } else {
      const d = digitIndex(e.key);
      if (d >= 0) {
        const first = virtualize ? Math.floor(scrollTop / rowH) : 0;
        const idx = first + d;
        if (idx < sorted.length) {
          e.preventDefault();
          e.stopPropagation();
          setFocusIdx(idx);
          if (onRowClick) onRowClick(sorted[idx], idx);
        }
      }
      return;
    }
    if (next != null) {
      e.preventDefault();
      e.stopPropagation();
      setFocusIdx(next);
      ensureVisible(next);
    }
  };

  const colCount = columns.length + (numbered ? 1 : 0);
  const headerCell = (c) => {
    const active = sort && sort.key === c.key;
    const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    return (
      <th key={c.key} className={`pb-dt__th pb-dt__th--${c.align || "right"}`} style={c.width ? { width: c.width } : undefined} aria-sort={c.sortable ? ariaSort : undefined}>
        {c.sortable ? (
          <button
            type="button"
            className="pb-reset pb-dt__sort"
            onClick={() => onSort && onSort({ key: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
          >
            {c.label}
            {active && <span className="pb-dt__caret" aria-hidden="true">{sort.dir === "asc" ? "▲" : "▼"}</span>}
          </button>
        ) : c.label}
      </th>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={`pb-dt${virtualize ? " pb-dt--virtual" : ""}${navigable ? " pb-dt--nav" : ""}${className ? " " + className : ""}`}
      style={virtualize ? { height, overflow: "auto" } : undefined}
      onScroll={virtualize ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
    >
      <table className="pb-dt__table">
        <thead>
          <tr>
            {numbered && <th className="pb-dt__th pb-dt__num" aria-label="Row number" />}
            {columns.map(headerCell)}
          </tr>
        </thead>
        <tbody>
          {loading && !sorted.length ? (
            <tr><td colSpan={colCount}><Skeleton rows={skeletonRows} /></td></tr>
          ) : !sorted.length ? (
            <tr><td colSpan={colCount}><EmptyState>{empty}</EmptyState></td></tr>
          ) : (
            <>
              {virtualize && win.start > 0 && (
                <tr aria-hidden="true" style={{ height: win.start * rowH }}><td colSpan={colCount} /></tr>
              )}
              {slice.map((row, j) => {
                const i = win.start + j;
                const key = keyOf(row, i);
                const selected = selectedKey != null && key === selectedKey;
                const tabIndex = navigable ? (i === (focusIdx < 0 ? 0 : focusIdx) ? 0 : -1) : undefined;
                return (
                  <tr
                    key={key}
                    data-row-index={i}
                    tabIndex={tabIndex}
                    className={`pb-dt__tr${selected ? " pb-dt__tr--selected" : ""}${onRowClick ? " pb-dt__tr--click" : ""}`}
                    aria-selected={selected || undefined}
                    onClick={onRowClick ? () => { setFocusIdx(i); onRowClick(row, i); } : undefined}
                    onFocus={navigable ? () => setFocusIdx(i) : undefined}
                  >
                    {numbered && <td className="pb-dt__td pb-dt__num">{i + 1})</td>}
                    {columns.map((c) => (
                      <td key={c.key} className={`pb-dt__td pb-dt__td--${c.align || "right"}`}>
                        {c.render ? c.render(row, i) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {virtualize && win.end < sorted.length && (
                <tr aria-hidden="true" style={{ height: (sorted.length - win.end) * rowH }}><td colSpan={colCount} /></tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Append the Kit B styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Kit B - DataTable
   ============================================================ */
.pb-dt { position: relative; min-width: 0; overflow-x: auto; }
.pb-dt__table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-sm); }
.pb-dt__th { position: sticky; top: 0; z-index: 1; height: var(--row-h); padding: 0 var(--cell-px); background: var(--c-bg); color: var(--c-text-muted); font-size: var(--fs-label); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; border-bottom: 1px solid var(--c-line); }
.pb-dt__th--right { text-align: right; }
.pb-dt__th--left { text-align: left; }
.pb-dt__sort { display: inline-flex; align-items: center; gap: 4px; text-transform: inherit; letter-spacing: inherit; color: inherit; }
.pb-dt__sort:hover { color: var(--c-text); }
.pb-dt__caret { font-size: 8px; }
.pb-dt__th[aria-sort="ascending"] .pb-dt__sort, .pb-dt__th[aria-sort="descending"] .pb-dt__sort { color: var(--c-text); }
.pb-dt__td { height: var(--row-h); padding: 0 var(--cell-px); white-space: nowrap; border-bottom: 1px solid var(--c-line); vertical-align: middle; }
.pb-dt__td--right { text-align: right; }
.pb-dt__td--left { text-align: left; }
.pb-dt__num { width: 1%; padding-right: 0; color: var(--c-text-muted); text-align: left; }
.pb-dt__tr--click { cursor: pointer; }
.pb-dt__tr:hover > .pb-dt__td { background: var(--c-hover); }
.pb-dt__tr--selected > .pb-dt__td { background: var(--c-selected); }
.pb-dt__tr--selected > .pb-dt__td:first-child { box-shadow: inset 2px 0 0 var(--c-accent); }
.pb-dt__tr:focus-visible { outline: 1px solid var(--c-accent); outline-offset: -1px; }
```

- [ ] **Step 7: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "ui: DataTable with sorting, keyboard navigation, numbering, virtualisation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Kit part C, layers, drawer, toasts, dialog, list-detail, chart frame

**Files:**
- Create: `src/ui/layers.js`, `src/ui/focusTrap.js`, `src/ui/toasts.js`, `src/ui/dialog.js`
- Create: `src/ui/Drawer.jsx`, `src/ui/Toasts.jsx`, `src/ui/Dialog.jsx`, `src/ui/ListDetail.jsx`, `src/ui/ChartFrame.jsx`
- Test: `src/ui/layers.test.js`, `src/ui/toasts.test.js`
- Modify: `src/theme/index.css` (append "Kit C" block before LEGACY)

- [ ] **Step 1: Write the failing tests**

Create `src/ui/layers.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pushLayer, popLayer, closeTopLayer, layerCount, topLayerId } from "./layers.js";

test("layers close top-most first and tolerate double pops", () => {
  const closed = [];
  pushLayer("a", () => closed.push("a"));
  const disposeB = pushLayer("b", () => closed.push("b"));
  assert.equal(layerCount(), 2);
  assert.equal(topLayerId(), "b");
  assert.equal(closeTopLayer(), true);
  assert.deepEqual(closed, ["b"]);
  assert.equal(layerCount(), 1);
  disposeB();
  assert.equal(layerCount(), 1);
  assert.equal(closeTopLayer(), true);
  assert.deepEqual(closed, ["b", "a"]);
  assert.equal(closeTopLayer(), false);
  popLayer("never-pushed");
  assert.equal(layerCount(), 0);
});
```

Create `src/ui/toasts.test.js`:

```js
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { toast, dismissToast, getToasts, clearToasts } from "./toasts.js";

test("toast stacks to five, auto-dismisses, sticky ones stay", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  clearToasts();
  for (let i = 0; i < 6; i += 1) toast({ title: "t" + i, ttlMs: 1000 });
  assert.equal(getToasts().length, 5);
  assert.equal(getToasts()[0].title, "t1");
  mock.timers.tick(1001);
  assert.equal(getToasts().length, 0);
  const id = toast({ title: "sticky", sticky: true });
  mock.timers.tick(10_000);
  assert.equal(getToasts().length, 1);
  const before = getToasts();
  assert.equal(getToasts(), before);
  dismissToast(id);
  assert.equal(getToasts().length, 0);
  mock.timers.reset();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/ui/layers.test.js src/ui/toasts.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the module stores**

`src/ui/layers.js`:
```js
// Stack of open floating layers (command line, popovers, drawer, dialogs,
// sheet). Escape closes the top-most one; each layer registers its own
// close handler. No React here; the hook is below in the same file's sibling.
const stack = [];

export function pushLayer(id, onClose) {
  popLayer(id);
  stack.push({ id, onClose });
  return () => popLayer(id);
}

export function popLayer(id) {
  const i = stack.findIndex((l) => l.id === id);
  if (i >= 0) stack.splice(i, 1);
}

export function closeTopLayer() {
  const top = stack.pop();
  if (!top) return false;
  top.onClose();
  return true;
}

export function layerCount() {
  return stack.length;
}

export function topLayerId() {
  return stack.length ? stack[stack.length - 1].id : null;
}
```

`src/ui/useLayer.js`:
```js
import { useEffect, useId, useRef } from "react";
import { pushLayer, popLayer } from "./layers.js";

// Register the calling component as an Escape-closable layer while `open`.
export function useLayer(open, onClose) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    pushLayer(id, () => closeRef.current());
    return () => popLayer(id);
  }, [open, id]);
}
```

`src/ui/focusTrap.js`:
```js
import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keep Tab inside `ref` while active; restore the previous focus afterwards.
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    const previous = document.activeElement;
    const first = root.querySelector(FOCUSABLE);
    (first || root).focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function") previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
```

`src/ui/toasts.js`:
```js
import { newId } from "../lib/id.js";

// In-memory toast queue. Max five; the oldest drops first. Sticky toasts
// (alerts) stay until dismissed; others auto-dismiss.
const MAX = 5;
let items = [];
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function getToasts() { return items; }
export function subscribeToasts(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function toast({ tone = "info", title, body = "", actions = [], sticky = false, ttlMs = 4000 }) {
  const id = newId();
  items = [...items, { id, tone, title, body, actions, sticky, createdAt: Date.now() }].slice(-MAX);
  emit();
  if (!sticky) setTimeout(() => dismissToast(id), ttlMs);
  return id;
}

export function dismissToast(id) {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) { items = next; emit(); }
}

export function clearToasts() {
  if (items.length) { items = []; emit(); }
}
```

`src/ui/dialog.js`:
```js
// Confirmation dialog state. `confirm()` resolves true or false; DialogHost renders it.
let pending = null;
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function getDialog() { return pending; }
export function subscribeDialog(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function confirm({ title, body = "", confirmLabel = "CONFIRM", cancelLabel = "CANCEL", danger = false }) {
  return new Promise((resolve) => {
    if (pending) pending.resolve(false);
    pending = { title, body, confirmLabel, cancelLabel, danger, resolve };
    emit();
  });
}

export function settleDialog(result) {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.resolve(result);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test src/ui/layers.test.js src/ui/toasts.test.js`
Expected: `ℹ pass 2`, `ℹ fail 0`.

- [ ] **Step 5: Create the components**

`src/ui/Drawer.jsx`:
```jsx
import { useRef } from "react";
import { X } from "lucide-react";
import { useLayer } from "./useLayer.js";
import { useFocusTrap } from "./focusTrap.js";

// Right-hand sheet. `header` replaces the default title bar when given.
export function Drawer({ open, onClose, title, header, ariaLabel, width, className = "", children }) {
  const ref = useRef(null);
  useLayer(open, onClose);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div className="pb-scrim pb-scrim--right" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        ref={ref}
        className={`pb-drawer${className ? " " + className : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : "Panel")}
        style={width ? { width } : undefined}
        tabIndex={-1}
      >
        {header || (
          <header className="pb-drawer__head">
            <span className="pb-drawer__title">{title}</span>
            <button type="button" className="pb-reset pb-drawer__close" aria-label="Close" onClick={onClose}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </header>
        )}
        <div className="pb-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
```

`src/ui/Toasts.jsx`:
```jsx
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { getToasts, subscribeToasts, dismissToast } from "./toasts.js";

export function Toasts() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (!items.length) return null;
  return (
    <div className="pb-toasts" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className={`pb-toast pb-toast--${t.tone}`} role="status">
          <div className="pb-toast__text">
            <div className="pb-toast__title">{t.title}</div>
            {t.body && <div className="pb-toast__body">{t.body}</div>}
          </div>
          {t.actions.map((a) => (
            <button key={a.label} type="button" className="pb-reset pb-toast__action" onClick={() => { a.run(); dismissToast(t.id); }}>
              {a.label}
            </button>
          ))}
          <button type="button" className="pb-reset pb-toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

`src/ui/Dialog.jsx`:
```jsx
import { useRef, useSyncExternalStore } from "react";
import { getDialog, subscribeDialog, settleDialog } from "./dialog.js";
import { useLayer } from "./useLayer.js";
import { useFocusTrap } from "./focusTrap.js";
import { Button } from "./Button.jsx";

export function DialogHost() {
  const d = useSyncExternalStore(subscribeDialog, getDialog, getDialog);
  const ref = useRef(null);
  const open = Boolean(d);
  useLayer(open, () => settleDialog(false));
  useFocusTrap(ref, open);
  if (!d) return null;
  return (
    <div className="pb-scrim pb-scrim--center" onMouseDown={(e) => { if (e.target === e.currentTarget) settleDialog(false); }}>
      <div ref={ref} className="pb-dialogbox" role="alertdialog" aria-modal="true" aria-labelledby="pb-dialog-title" tabIndex={-1}>
        <div id="pb-dialog-title" className="pb-dialogbox__title">{d.title}</div>
        {d.body && <div className="pb-dialogbox__body">{d.body}</div>}
        <div className="pb-dialogbox__actions">
          <Button onClick={() => settleDialog(false)}>{d.cancelLabel}</Button>
          <Button variant={d.danger ? "danger" : "primary"} onClick={() => settleDialog(true)}>{d.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
```

`src/ui/ListDetail.jsx`:
```jsx
import { useIsMobile } from "../data/hooks.js";
import { Select } from "./Select.jsx";

// Desktop: list left, detail right. Mobile: a native selector above the detail.
// mobile: { label, options: [{ value, label }], value, onChange }
export function ListDetail({ list, detail, listWidth = 220, mobile, className = "" }) {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return (
      <div className={`pb-ld pb-ld--mobile${className ? " " + className : ""}`}>
        {mobile && (
          <div className="pb-ld__selector">
            <Select aria-label={mobile.label} options={mobile.options} value={mobile.value} onChange={mobile.onChange} />
          </div>
        )}
        <div className="pb-ld__detail">{detail}</div>
      </div>
    );
  }
  return (
    <div className={`pb-ld${className ? " " + className : ""}`} style={{ gridTemplateColumns: `${listWidth}px minmax(0, 1fr)` }}>
      <div className="pb-ld__list">{list}</div>
      <div className="pb-ld__detail">{detail}</div>
    </div>
  );
}
```

`src/ui/ChartFrame.jsx`:
```jsx
import { useMemo } from "react";
import { ResponsiveContainer } from "recharts";
import { useResolvedTheme } from "../theme/useResolvedTheme.js";
import { Loading } from "./Loading.jsx";
import { EmptyState } from "./EmptyState.jsx";

// Recharts needs concrete colours for SVG attributes, so read the tokens once
// per theme change instead of hardcoding a palette in JS.
function readColors(theme) {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  const series = theme === "light"
    ? ["#6d28d9", "#8b5cf6", "#6e6e6e", "#a78bfa", "#3f3f46", "#c4b5fd"]
    : ["#8b5cf6", "#a78bfa", "#787878", "#c4b5fd", "#5b5b66", "#ddd6fe"];
  return {
    accent: g("--c-accent"), accentText: g("--c-accent-text"), text: g("--c-text"), dim: g("--c-text-dim"),
    muted: g("--c-text-muted"), line: g("--c-line"), lineStrong: g("--c-line-strong"), up: g("--c-up"),
    down: g("--c-down"), warn: g("--c-warn"), raised: g("--c-raised"), bg: g("--c-bg"), series,
  };
}

export function useChartColors() {
  const theme = useResolvedTheme();
  return useMemo(() => readColors(theme), [theme]);
}

// Spread these onto <CartesianGrid>, <XAxis>/<YAxis>, and <Tooltip>.
export function useChartTheme() {
  const colors = useChartColors();
  return useMemo(() => ({
    colors,
    gridProps: { stroke: colors.line, vertical: false },
    axisProps: { tick: { fill: colors.muted, fontSize: 10, fontFamily: "inherit" }, tickLine: false, axisLine: false, stroke: colors.muted },
    tooltipProps: {
      contentStyle: { background: colors.raised, border: `1px solid ${colors.lineStrong}`, borderRadius: 0, fontSize: 11, fontFamily: "inherit", padding: "6px 8px" },
      labelStyle: { color: colors.muted, fontSize: 10, marginBottom: 2 },
      itemStyle: { color: colors.text, fontSize: 11, padding: 0 },
      cursor: { stroke: colors.muted, strokeWidth: 1 },
    },
  }), [colors]);
}

export function ChartFrame({ height = 280, loading = false, empty = null, className = "", children }) {
  return (
    <div className={`pb-chart${className ? " " + className : ""}`} style={{ height }}>
      {loading ? <Loading /> : empty ? <EmptyState>{empty}</EmptyState> : (
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      )}
    </div>
  );
}

// Faint vertical fade for area fills (8% at the top, 0 at the bottom).
export function ChartGradient({ id, color, from = 0.08, to = 0 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={from} />
      <stop offset="95%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}
```

- [ ] **Step 6: Append the Kit C styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Kit C - layers, drawer, toasts, dialog, list-detail, chart
   ============================================================ */
.pb-scrim { position: fixed; inset: 0; z-index: var(--z-layer); background: var(--c-scrim); display: flex; }
.pb-scrim--right { justify-content: flex-end; }
.pb-scrim--center { align-items: center; justify-content: center; }
.pb-drawer { width: var(--drawer-w); max-width: 100%; height: 100%; background: var(--c-raised); border-left: 1px solid var(--c-line-strong); display: flex; flex-direction: column; animation: pb-slide-in var(--t-slide); }
.pb-drawer__head { display: flex; align-items: center; gap: 8px; min-height: var(--top-h); padding: 0 var(--cell-px); border-bottom: 1px solid var(--c-line); }
.pb-drawer__title { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-accent-text); }
.pb-drawer__close { margin-left: auto; color: var(--c-text-muted); display: inline-flex; padding: 4px; }
.pb-drawer__close:hover { color: var(--c-text); }
.pb-drawer__body { flex: 1; overflow: auto; min-height: 0; }
@media (max-width: 767px) { .pb-drawer { width: 100%; border-left: 0; } }

.pb-toasts { position: fixed; right: 12px; bottom: calc(var(--tape-h) + 12px); z-index: var(--z-toast); display: flex; flex-direction: column; gap: 6px; width: 320px; max-width: calc(100vw - 24px); }
.pb-toast { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: var(--c-raised); border: 1px solid var(--c-line-strong); animation: pb-rise var(--t-fast); }
.pb-toast--warn { border-color: var(--c-warn); }
.pb-toast__text { flex: 1; min-width: 0; }
.pb-toast__title { font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.04em; }
.pb-toast--warn .pb-toast__title { color: var(--c-warn); }
.pb-toast__body { font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
.pb-toast__action { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-accent-text); padding: 2px 4px; border: 1px solid var(--c-line-strong); }
.pb-toast__close { color: var(--c-text-muted); display: inline-flex; padding: 2px; }
@media (max-width: 767px) { .pb-toasts { bottom: 68px; } }

.pb-dialogbox { width: 360px; max-width: calc(100vw - 24px); background: var(--c-raised); border: 1px solid var(--c-line-strong); padding: var(--sec-pad); animation: pb-rise var(--t-fast); }
.pb-dialogbox__title { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-accent-text); margin-bottom: 8px; }
.pb-dialogbox__body { font-size: var(--fs-sm); color: var(--c-text-dim); margin-bottom: 12px; }
.pb-dialogbox__actions { display: flex; justify-content: flex-end; gap: 6px; }

.pb-ld { display: grid; min-height: 100%; }
.pb-ld__list { border-right: 1px solid var(--c-line); min-width: 0; overflow: auto; }
.pb-ld__detail { min-width: 0; overflow: auto; }
.pb-ld--mobile { display: flex; flex-direction: column; }
.pb-ld__selector { padding: var(--cell-py) var(--cell-px); border-bottom: 1px solid var(--c-line); }

.pb-chart { width: 100%; min-width: 0; }
.pb-chart .recharts-cartesian-axis-tick-value { font-family: inherit; }
.pb-chart .recharts-tooltip-wrapper { outline: none; }
```

- [ ] **Step 7: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "ui: layers, focus trap, drawer, toasts, confirm dialog, list-detail, chart frame

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 13: Ticker, watchlist actions, quick-look drawer, alerts engine, news feed

**Files:**
- Create: `src/ui/quickLookContext.js`, `src/ui/watchActions.js`, `src/ui/Ticker.jsx`
- Create: `src/features/AlertForm.jsx`, `src/features/quickLook.jsx`, `src/features/useAlertsEngine.js`, `src/features/newsFeed.jsx`
- Test: `src/ui/watchActions.test.js`
- Modify: `src/theme/index.css` (append "Features" block before LEGACY)

- [ ] **Step 1: Write the failing test**

Create `src/ui/watchActions.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleWatch } from "./watchActions.js";
import { watchlist } from "../stores/watchlist.js";
import { getToasts, clearToasts } from "./toasts.js";

test("toggleWatch adds, removes, and offers undo through a toast", () => {
  watchlist.set({ symbols: ["AAPL"] });
  clearToasts();
  assert.equal(toggleWatch("nvda"), true);
  assert.deepEqual(watchlist.get().symbols, ["AAPL", "NVDA"]);
  assert.equal(getToasts().at(-1).title, "NVDA ADDED TO WATCHLIST");
  getToasts().at(-1).actions[0].run(); // undo
  assert.deepEqual(watchlist.get().symbols, ["AAPL"]);
  assert.equal(toggleWatch("AAPL"), false);
  assert.deepEqual(watchlist.get().symbols, []);
  assert.equal(toggleWatch("not a symbol"), false);
  clearToasts();
  watchlist.reset();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/ui/watchActions.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the context, actions, and Ticker**

`src/ui/quickLookContext.js`:
```js
import { createContext, useContext } from "react";

// Provided by features/quickLook.jsx. Default is a no-op so kit components
// render safely in isolation.
export const QuickLookContext = createContext({ symbol: null, open: () => {}, close: () => {} });

export function useQuickLook() {
  return useContext(QuickLookContext);
}
```

`src/ui/watchActions.js`:
```js
import { watchlist, addToList, removeFromList, normalizeSymbol, WATCHLIST_MAX } from "../stores/watchlist.js";
import { toast } from "./toasts.js";

// Star toggle used by Ticker, quick-look, and screen headers. Returns the new
// membership. Every change gets a toast with Undo.
export function toggleWatch(symbol) {
  const sym = normalizeSymbol(symbol);
  if (!sym) return false;
  const was = watchlist.get().symbols.includes(sym);
  watchlist.update((s) => ({ ...s, symbols: was ? removeFromList(s.symbols, sym) : addToList(s.symbols, sym) }));
  const isIn = watchlist.get().symbols.includes(sym);
  if (!was && !isIn) {
    toast({ tone: "warn", title: "WATCHLIST FULL", body: `${sym} not added (max ${WATCHLIST_MAX})` });
    return false;
  }
  toast({
    title: was ? `${sym} REMOVED FROM WATCHLIST` : `${sym} ADDED TO WATCHLIST`,
    actions: [{
      label: "UNDO",
      run: () => watchlist.update((s) => ({ ...s, symbols: was ? addToList(s.symbols, sym) : removeFromList(s.symbols, sym) })),
    }],
  });
  return isIn;
}
```

`src/ui/Ticker.jsx`:
```jsx
import { Star } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { useQuickLook } from "./quickLookContext.js";
import { toggleWatch } from "./watchActions.js";

// Every symbol on screen is a Ticker: click opens quick-look, the star toggles
// the watchlist. Both stop propagation so table rows keep their own click.
export function Ticker({ symbol, name, star = true, className = "" }) {
  const { open } = useQuickLook();
  const starred = useStore(watchlist, (s) => s.symbols.includes(symbol));
  return (
    <span className={`pb-ticker${className ? " " + className : ""}`}>
      <button
        type="button"
        className="pb-reset pb-ticker__sym"
        title={name ? `${name} · quick look` : "Quick look"}
        onClick={(e) => { e.stopPropagation(); open(symbol); }}
      >
        {symbol}
      </button>
      {star && (
        <button
          type="button"
          className={`pb-reset pb-ticker__star${starred ? " pb-ticker__star--on" : ""}`}
          aria-label={starred ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          aria-pressed={starred}
          onClick={(e) => { e.stopPropagation(); toggleWatch(symbol); }}
        >
          <Star size={11} strokeWidth={1.5} fill={starred ? "currentColor" : "none"} />
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test src/ui/watchActions.test.js`
Expected: `ℹ pass 1`, `ℹ fail 0`.

- [ ] **Step 5: Create the feature modules**

`src/features/newsFeed.jsx`:
```jsx
import { createContext, useContext, useMemo } from "react";
import { useNews } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";

// One news poll for the whole app. The feed follows the first four watchlist
// symbols; the old hardcoded six remain the fallback for an empty watchlist.
const DEFAULT_NEWS = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "JPM"];

const NewsContext = createContext({ news: [], loading: true, updatedAt: null, intervalMs: 45000 });

export function NewsProvider({ children }) {
  const watch = useStore(watchlist, (s) => s.symbols);
  const symbols = useMemo(() => (watch.length ? watch.slice(0, 4) : DEFAULT_NEWS), [watch]);
  const { data, loading, updatedAt, intervalMs } = useNews(symbols, 45000);
  const value = useMemo(() => ({ news: data, loading, updatedAt, intervalMs }), [data, loading, updatedAt, intervalMs]);
  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNewsFeed() {
  return useContext(NewsContext);
}
```

`src/features/AlertForm.jsx`:
```jsx
import { useState } from "react";
import { Segmented } from "../ui/Segmented.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { toast } from "../ui/toasts.js";
import { addAlert } from "../stores/alerts.js";
import { conditionHolds } from "../lib/alerts.js";
import { fmtNum } from "../lib/format.js";

// Inline alert form used by quick-look (and by screen headers in P2).
export function AlertForm({ symbol, currentPrice, onDone }) {
  const [op, setOp] = useState("above");
  const [price, setPrice] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : "");
  const target = parseFloat(price);
  const valid = Number.isFinite(target) && target > 0;
  const alreadyHolds = valid && currentPrice > 0 && conditionHolds(op, currentPrice, target);

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    addAlert({ symbol, op, price: target, baseline: currentPrice > 0 ? currentPrice : null });
    toast({ title: `ALERT ARMED · ${symbol} ${op.toUpperCase()} ${fmtNum(target)}` });
    if (onDone) onDone();
  };

  return (
    <form className="pb-alertform" onSubmit={submit}>
      <div className="pb-alertform__row">
        <Segmented label="Direction" value={op} onChange={setOp} options={[{ value: "above", label: "ABOVE" }, { value: "below", label: "BELOW" }]} />
        <Input mono type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Alert price" placeholder="PRICE" />
        <Button type="submit" variant="primary" disabled={!valid}>SAVE</Button>
      </div>
      {alreadyHolds && (
        <div className="pb-alertform__note pb-warn">
          Already {op} {fmtNum(target)}. Fires the next time price crosses from the other side.
        </div>
      )}
    </form>
  );
}
```

`src/features/quickLook.jsx`:
```jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Star, X } from "lucide-react";
import { QuickLookContext } from "../ui/quickLookContext.js";
import { Drawer } from "../ui/Drawer.jsx";
import { Sparkline } from "../ui/Sparkline.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Button } from "../ui/Button.jsx";
import { Loading } from "../ui/Loading.jsx";
import { toggleWatch } from "../ui/watchActions.js";
import { useStore } from "../stores/useStore.js";
import { watchlist, normalizeSymbol } from "../stores/watchlist.js";
import { useQuote, usePoolExtra } from "../data/quotePool.jsx";
import { useHistorical } from "../data/hooks.js";
import { navigate, pathFor } from "../router/index.jsx";
import { fmt, fmtK, fmtNum, fmtSigned } from "../lib/format.js";
import { useNewsFeed } from "./newsFeed.jsx";
import { AlertForm } from "./AlertForm.jsx";

export function QuickLookProvider({ children }) {
  const [symbol, setSymbol] = useState(null);
  const open = useCallback((s) => { const n = normalizeSymbol(s); if (n) setSymbol(n); }, []);
  const close = useCallback(() => setSymbol(null), []);
  const value = useMemo(() => ({ symbol, open, close }), [symbol, open, close]);
  return (
    <QuickLookContext.Provider value={value}>
      {children}
      <QuickLookDrawer symbol={symbol} onClose={close} />
    </QuickLookContext.Provider>
  );
}

function QuickLookDrawer({ symbol, onClose }) {
  usePoolExtra(symbol);
  const q = useQuote(symbol);
  const { data: hist } = useHistorical(symbol, "1mo");
  const { news } = useNewsFeed();
  const [alertOpen, setAlertOpen] = useState(false);
  useEffect(() => { setAlertOpen(false); }, [symbol]);
  const starred = useStore(watchlist, (s) => (symbol ? s.symbols.includes(symbol) : false));
  const closes = useMemo(() => hist.map((d) => d.close), [hist]);
  const headlines = useMemo(
    () => (news || []).filter((n) => (n.relatedSymbol || "").toUpperCase() === symbol).slice(0, 3),
    [news, symbol]
  );

  const goEquities = () => { navigate(pathFor("equities", { symbol })); onClose(); };
  const goPortfolio = () => { navigate(pathFor("portfolio", {}, { tab: "transactions", symbol })); onClose(); };

  const range52 = q && q.week52High > q.week52Low && q.week52Low > 0
    ? Math.min(100, Math.max(0, ((q.price - q.week52Low) / (q.week52High - q.week52Low)) * 100))
    : null;

  const header = symbol ? (
    <header className="pb-drawer__head pb-ql__head">
      <span className="pb-ql__sym">{symbol}</span>
      <span className="pb-ql__name pb-muted">{q ? q.name : ""}</span>
      <span className="pb-ql__tools">
        <button type="button" className={`pb-reset pb-iconbtn${starred ? " pb-accent" : ""}`} aria-label={starred ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={starred} onClick={() => toggleWatch(symbol)}>
          <Star size={13} strokeWidth={1.5} fill={starred ? "currentColor" : "none"} />
        </button>
        <button type="button" className={`pb-reset pb-iconbtn${alertOpen ? " pb-accent" : ""}`} aria-label="Set price alert" aria-expanded={alertOpen} onClick={() => setAlertOpen((v) => !v)}>
          <Bell size={13} strokeWidth={1.5} />
        </button>
        <button type="button" className="pb-reset pb-iconbtn" aria-label="Close" onClick={onClose}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </span>
    </header>
  ) : null;

  return (
    <Drawer open={Boolean(symbol)} onClose={onClose} header={header} ariaLabel={`Quick look ${symbol || ""}`}>
      {symbol && (
        <div className="pb-ql">
          {!q ? <Loading /> : (
            <>
              <div className="pb-ql__price">
                <Price value={q.price} format={(v) => fmtNum(v, 2)} className="pb-ql__last" />
                <span className={q.change >= 0 ? "pb-up" : "pb-down"}>{fmtSigned(q.change)} <Change value={q.changePercent} /></span>
                <span className="pb-ql__tags">
                  <Tag>{q.exchange || "—"}</Tag>
                  {q.marketState && <Tag tone={q.marketState === "REGULAR" ? "up" : undefined}>{q.marketState === "REGULAR" ? "OPEN" : q.marketState}</Tag>}
                </span>
              </div>
              <div className="pb-ql__spark">
                {closes.length > 1 ? <Sparkline values={closes} width={330} height={56} /> : <span className="pb-label">1M CHART LOADING…</span>}
              </div>
              {alertOpen && <div className="pb-ql__alert"><AlertForm symbol={symbol} currentPrice={q.price} onDone={() => setAlertOpen(false)} /></div>}
              <KVList cols={2}>
                <KV k="OPEN" v={fmtNum(q.open)} />
                <KV k="PREV" v={fmtNum(q.prevClose)} />
                <KV k="HI" v={fmtNum(q.high)} />
                <KV k="LO" v={fmtNum(q.low)} />
                <KV k="VOL" v={fmtK(q.volume)} />
                <KV k="AVG VOL" v={fmtK(q.avgVolume)} />
                <KV k="MKT CAP" v={q.marketCap > 0 ? fmtK(q.marketCap) : "—"} />
                <KV k="P/E" v={q.pe > 0 ? fmt(q.pe, 1) + "x" : "—"} />
                <KV k="EPS" v={q.eps ? fmt(q.eps) : "—"} />
                <KV k="DIV YLD" v={q.dividendYield > 0 ? fmt(q.dividendYield) + "%" : "—"} />
                <KV k="BETA" v={q.beta ? fmt(q.beta) : "—"} />
                <KV k="52W" v={q.week52Low > 0 ? `${fmt(q.week52Low, 0)} – ${fmt(q.week52High, 0)}` : "—"} />
              </KVList>
              {range52 != null && (
                <div className="pb-ql__range" title="Position in the 52-week range">
                  <div className="pb-ql__rangebar"><span style={{ left: `${range52}%` }} /></div>
                  <div className="pb-ql__rangelbl pb-label"><span>52W LO</span><span>{range52.toFixed(0)}%</span><span>52W HI</span></div>
                </div>
              )}
            </>
          )}
          <div className="pb-ql__news">
            <div className="pb-label pb-ql__newshead">HEADLINES</div>
            {headlines.length === 0 ? (
              <div className="pb-muted pb-ql__nonews">No headlines for {symbol} in the current feed.</div>
            ) : headlines.map((n) => (
              <a key={n.link || n.title} className="pb-ql__headline" href={n.link} target="_blank" rel="noopener noreferrer">
                <div>{n.title}</div>
                <div className="pb-muted pb-label">
                  {n.publisher}
                  {n.publishedAt ? ` · ${new Date(n.publishedAt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}
                </div>
              </a>
            ))}
          </div>
          <div className="pb-ql__actions">
            <Button variant="primary" onClick={goEquities}>OPEN IN EQUITIES</Button>
            <Button onClick={goPortfolio}>ADD TO PORTFOLIO</Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
```

`src/features/useAlertsEngine.js`:
```js
import { useEffect } from "react";
import { useQuotePool } from "../data/quotePool.jsx";
import { useStore } from "../stores/useStore.js";
import { alerts, replaceAlertItems, rearmAlert } from "../stores/alerts.js";
import { settings } from "../stores/settings.js";
import { evaluateAlerts } from "../lib/alerts.js";
import { toast } from "../ui/toasts.js";
import { fmtNum, fmtClock } from "../lib/format.js";

// Runs once at the app root. Re-evaluates every alert on each quote-pool update.
export function useAlertsEngine() {
  const pool = useQuotePool();
  const items = useStore(alerts, (s) => s.items);
  const notify = useStore(settings, (s) => s.notifications);

  useEffect(() => {
    if (!items.length || !pool.bySymbol.size) return;
    const { fired, next } = evaluateAlerts(items, (sym) => pool.bySymbol.get(sym)?.price ?? null);
    if (next !== items) replaceAlertItems(next);
    for (const a of fired) {
      const title = `ALERT · ${a.symbol} ${a.op === "above" ? "ABOVE" : "BELOW"} ${fmtNum(a.price)}`;
      const body = `LAST ${fmtNum(a.triggeredPrice)} · ${fmtClock(new Date(a.triggeredAt))}`;
      toast({ tone: "warn", title, body, sticky: true, actions: [{ label: "RE-ARM", run: () => rearmAlert(a.id, a.triggeredPrice) }] });
      if (notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); } catch { /* notifications blocked */ }
      }
    }
  }, [pool.bySymbol, items, notify]);
}
```

- [ ] **Step 6: Append the Features styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Features - ticker, quick-look, alert form
   ============================================================ */
.pb-ticker { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
.pb-ticker__sym { font-weight: 600; color: var(--c-text); }
.pb-ticker__sym:hover { color: var(--c-accent-text); text-decoration: underline; }
.pb-ticker__star { display: inline-flex; color: var(--c-text-muted); opacity: 0; padding: 2px; transition: opacity var(--t-fast); }
.pb-ticker:hover .pb-ticker__star, .pb-ticker__star:focus-visible, .pb-ticker__star--on { opacity: 1; }
.pb-ticker__star--on { color: var(--c-accent-text); }
@media (hover: none) { .pb-ticker__star { opacity: 1; } }

.pb-ql { display: flex; flex-direction: column; }
.pb-ql__head { gap: 8px; }
.pb-ql__sym { font-size: var(--fs-lg); font-weight: 600; }
.pb-ql__name { font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.pb-ql__tools { display: inline-flex; gap: 2px; margin-left: auto; }
.pb-ql__price { display: flex; align-items: baseline; gap: 10px; padding: var(--sec-pad) var(--cell-px) 4px; flex-wrap: wrap; }
.pb-ql__last { font-size: var(--fs-xl); font-weight: 600; }
.pb-ql__tags { display: inline-flex; gap: 4px; margin-left: auto; }
.pb-ql__spark { padding: 4px var(--cell-px) var(--cell-py); border-bottom: 1px solid var(--c-line); min-height: 64px; display: flex; align-items: center; }
.pb-ql__alert { padding: var(--cell-py) var(--cell-px); border-bottom: 1px solid var(--c-line); background: var(--c-selected); }
.pb-ql__range { padding: var(--cell-py) var(--cell-px); border-bottom: 1px solid var(--c-line); }
.pb-ql__rangebar { position: relative; height: 4px; background: var(--c-line-strong); }
.pb-ql__rangebar span { position: absolute; top: -3px; width: 2px; height: 10px; background: var(--c-accent); }
.pb-ql__rangelbl { display: flex; justify-content: space-between; margin-top: 4px; }
.pb-ql__news { padding: var(--cell-py) var(--cell-px); border-bottom: 1px solid var(--c-line); }
.pb-ql__newshead { margin-bottom: 4px; }
.pb-ql__headline { display: block; padding: 4px 0; color: var(--c-text); font-size: var(--fs-sm); border-bottom: 1px solid var(--c-line); }
.pb-ql__headline:last-child { border-bottom: 0; }
.pb-ql__headline:hover { color: var(--c-accent-text); text-decoration: none; }
.pb-ql__nonews { font-size: var(--fs-sm); }
.pb-ql__actions { display: flex; gap: 6px; padding: var(--sec-pad) var(--cell-px); }

.pb-alertform__row { display: flex; gap: 6px; align-items: center; }
.pb-alertform__row .pb-input { width: 110px; }
.pb-alertform__note { font-size: var(--fs-sm); margin-top: 6px; }
```

- [ ] **Step 7: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "features: ticker with watchlist star, quick-look drawer, alert form and engine, news feed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Command line, global keyboard, shortcut sheet

**Files:**
- Create: `src/shell/commandParser.js`, `src/shell/suggestions.js`, `src/shell/commandLine.js`, `src/shell/help.js`, `src/shell/keyboard.js`
- Create: `src/shell/CommandLine.jsx`, `src/shell/ShortcutSheet.jsx`
- Test: `src/shell/command.test.js`
- Modify: `src/theme/index.css` (append "Command line" block before LEGACY)

- [ ] **Step 1: Write the failing tests**

Create `src/shell/command.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "./commandParser.js";
import { buildSuggestions } from "./suggestions.js";

test("parseCommand grammar", () => {
  assert.deepEqual(parseCommand(""), { kind: "empty" });
  assert.deepEqual(parseCommand("wei"), { kind: "navigate", name: "dashboard", params: {}, query: {} });
  assert.deepEqual(parseCommand("DES AAPL"), { kind: "navigate", name: "equities", params: { symbol: "AAPL" }, query: {} });
  assert.deepEqual(parseCommand("aapl des"), { kind: "navigate", name: "equities", params: { symbol: "AAPL" }, query: {} });
  assert.deepEqual(parseCommand("WFX eur/usd"), { kind: "navigate", name: "fx", params: { pair: "EURUSD" }, query: {} });
  assert.deepEqual(parseCommand("CRYP Bitcoin"), { kind: "navigate", name: "crypto", params: { id: "bitcoin" }, query: {} });
  assert.deepEqual(parseCommand("eco"), { kind: "navigate", name: "rates", params: {}, query: { tab: "calendar" } });
  assert.deepEqual(parseCommand("EQS AAPL"), { kind: "navigate", name: "screener", params: {}, query: {} });
  assert.deepEqual(parseCommand("theme"), { kind: "command", command: "theme" });
  assert.deepEqual(parseCommand("nvda"), { kind: "search", query: "NVDA" });
  assert.deepEqual(parseCommand("apple inc"), { kind: "search", query: "APPLE INC" });
});

const pool = [
  { symbol: "AAPL", name: "Apple Inc", price: 1, changePercent: 0, exchange: "NMS" },
  { symbol: "AAL", name: "American Airlines", price: 1 },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "MSFT", name: "Microsoft" },
];

test("buildSuggestions: empty input lists functions then commands", () => {
  const items = buildSuggestions({ value: "", parsed: parseCommand(""), poolList: pool, watch: [] });
  assert.equal(items.length, 15);
  assert.equal(items[0].label, "WEI");
  assert.equal(items[14].label, "HELP");
});

test("buildSuggestions: a mnemonic yields exactly that function with its params", () => {
  const items = buildSuggestions({ value: "DES AAPL", parsed: parseCommand("DES AAPL"), poolList: pool });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "function");
  assert.deepEqual(items[0].params, { symbol: "AAPL" });
});

test("buildSuggestions: symbol search orders watchlist, tracked, then Yahoo without duplicates", () => {
  const items = buildSuggestions({
    value: "AA", parsed: parseCommand("AA"), poolList: pool, watch: ["AAPL"],
    yahoo: [{ symbol: "AAPL", name: "dup" }, { symbol: "AAOI", name: "Applied Opto", type: "EQUITY", exchange: "NMS" }],
  });
  assert.deepEqual(items.map((i) => `${i.kind}:${i.label}`), ["watch:AAPL", "tracked:AAL", "search:AAOI"]);
});

test("buildSuggestions: partial command", () => {
  const items = buildSuggestions({ value: "THE", parsed: parseCommand("THE"), poolList: pool });
  assert.deepEqual(items.map((i) => i.label), ["THEME"]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/shell/command.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the pure modules**

`src/shell/commandParser.js`:
```js
import { ROUTES, ALIASES } from "../router/routes.js";

// Grammar (input uppercased, whitespace-split):
//   "<MNEMONIC> [ARG]"  -> navigate, ARG fills the route's param when it has one
//   "<ARG> <MNEMONIC>"  -> same, Bloomberg order
//   "THEME" | "DENSITY" | "HELP" -> command
//   anything else       -> search
const BY_MNEMONIC = new Map(ROUTES.map((r) => [r.mnemonic, r]));
export const COMMANDS = { THEME: "theme", DENSITY: "density", HELP: "help" };

export function normaliseArg(routeName, arg) {
  if (routeName === "fx") {
    const letters = arg.replace(/[^A-Z]/g, "");
    return letters.length === 6 ? letters : arg;
  }
  if (routeName === "crypto") return arg.toLowerCase();
  return arg;
}

function route(mnemonic, rest) {
  const alias = ALIASES[mnemonic];
  if (alias) return { kind: "navigate", name: alias.name, params: {}, query: alias.query || {} };
  const r = BY_MNEMONIC.get(mnemonic);
  const arg = rest[0];
  const params = r.param && arg ? { [r.param]: normaliseArg(r.name, arg) } : {};
  return { kind: "navigate", name: r.name, params, query: {} };
}

const known = (t) => BY_MNEMONIC.has(t) || Object.prototype.hasOwnProperty.call(ALIASES, t);

export function parseCommand(input) {
  const tokens = String(input || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { kind: "empty" };
  if (tokens.length === 1 && COMMANDS[tokens[0]]) return { kind: "command", command: COMMANDS[tokens[0]] };
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (known(first)) return route(first, tokens.slice(1));
  if (tokens.length > 1 && known(last)) return route(last, tokens.slice(0, -1));
  return { kind: "search", query: tokens.join(" ") };
}
```

`src/shell/suggestions.js`:
```js
import { ROUTES } from "../router/routes.js";

// Suggestion rows for the command line. Plain data (no closures) so it is
// testable; CommandLine.jsx maps `kind` to an action.
export const COMMAND_ITEMS = [
  { id: "cmd:THEME", kind: "command", command: "theme", label: "THEME", sub: "Cycle dark, light, system" },
  { id: "cmd:DENSITY", kind: "command", command: "density", label: "DENSITY", sub: "Toggle compact and comfortable" },
  { id: "cmd:HELP", kind: "command", command: "help", label: "HELP", sub: "Keyboard shortcuts" },
];

const fnItem = (r, params = {}, query = {}) => ({
  id: `fn:${r.mnemonic}`, kind: "function", label: r.mnemonic, sub: `${r.label} · ${r.title}`, routeName: r.name, params, query,
});

const symItem = (kind, row) => ({
  id: `${kind}:${row.symbol}`, kind, label: row.symbol, sub: row.name || "", symbol: row.symbol,
  price: row.price, changePercent: row.changePercent, right: row.exchange || "",
});

export function buildSuggestions({ value, parsed, poolList = [], watch = [], yahoo = [] }) {
  const q = String(value || "").trim().toUpperCase();
  if (parsed.kind === "navigate") {
    const r = ROUTES.find((x) => x.name === parsed.name);
    return r ? [fnItem(r, parsed.params, parsed.query)] : [];
  }
  if (parsed.kind === "command") return COMMAND_ITEMS.filter((c) => c.command === parsed.command);
  if (parsed.kind === "empty") return [...ROUTES.map((r) => fnItem(r)), ...COMMAND_ITEMS];

  const out = [];
  const seenSymbols = new Set();
  const pushSymbol = (item) => { if (!seenSymbols.has(item.symbol)) { seenSymbols.add(item.symbol); out.push(item); } };
  const bySym = new Map(poolList.map((x) => [x.symbol, x]));
  const hit = (row) => row.symbol.startsWith(q) || (row.name || "").toUpperCase().includes(q);

  for (const s of watch) {
    const row = bySym.get(s) || { symbol: s };
    if (hit(row)) pushSymbol(symItem("watch", row));
  }
  let tracked = 0;
  for (const row of poolList) {
    if (tracked >= 6) break;
    if (row.symbol.startsWith("^") || seenSymbols.has(row.symbol) || !hit(row)) continue;
    pushSymbol(symItem("tracked", row));
    tracked += 1;
  }
  let found = 0;
  for (const r of yahoo) {
    if (found >= 6) break;
    if (!r.symbol || seenSymbols.has(r.symbol)) continue;
    pushSymbol({ id: `search:${r.symbol}`, kind: "search", label: r.symbol, sub: r.name || "", symbol: r.symbol, right: [r.type, r.exchange].filter(Boolean).join(" · ") });
    found += 1;
  }
  for (const r of ROUTES) {
    if (r.mnemonic.startsWith(q) || r.label.toUpperCase().includes(q) || r.title.toUpperCase().includes(q)) out.push(fnItem(r));
  }
  for (const c of COMMAND_ITEMS) if (c.label.startsWith(q)) out.push(c);
  return out;
}

export const GROUP_LABELS = { function: "FUNCTIONS", watch: "WATCHLIST", tracked: "TRACKED", search: "SEARCH", command: "COMMANDS" };
```

`src/shell/commandLine.js`:
```js
// Tiny bus so the global keyboard layer can focus the command line without
// a React ref threading through the shell.
let handler = null;

export function registerCommandLine(fn) {
  handler = fn;
  return () => { if (handler === fn) handler = null; };
}

export function focusCommandLine(prefill = "") {
  if (handler) handler(prefill);
}
```

`src/shell/help.js`:
```js
import { createStore } from "../stores/createStore.js";

export const help = createStore("help", { open: false }, { storage: null, debounceMs: 0 });
export const openHelp = () => help.set({ open: true });
export const closeHelp = () => help.set({ open: false });

export const SHORTCUTS = [
  ["/", "Focus the command line"],
  ["Ctrl K", "Focus the command line"],
  ["Any letter or digit", "Start typing in the command line"],
  ["Enter", "GO: run the command or open the highlighted suggestion"],
  ["Shift Enter", "Open the highlighted symbol in quick look instead"],
  ["Esc", "Close the top-most layer"],
  ["?", "This sheet"],
  ["Up / Down", "Move in a list"],
  ["1 to 9", "Open the nth visible row of the focused list"],
  ["Space", "Star the focused row (watchlist)"],
  ["DES AAPL", "Command line: open Apple in Equities"],
  ["AAPL DES", "Same, Bloomberg order"],
  ["THEME / DENSITY / HELP", "Commands"],
];
```

`src/shell/keyboard.js`:
```js
import { closeTopLayer } from "../ui/layers.js";
import { focusCommandLine } from "./commandLine.js";
import { openHelp } from "./help.js";

function isEditable(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

// Global keys. Tables and the command line stop propagation for the keys
// they consume, so anything reaching here is unclaimed.
export function installKeyboard() {
  const handler = (e) => {
    if (e.key === "Escape") {
      if (closeTopLayer()) e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusCommandLine("");
      return;
    }
    if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); focusCommandLine(""); return; }
    if (e.key === "?") { e.preventDefault(); openHelp(); return; }
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      e.preventDefault();
      focusCommandLine(e.key.toUpperCase());
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test src/shell/command.test.js`
Expected: `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Create the components**

`src/shell/CommandLine.jsx`:
```jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { parseCommand } from "./commandParser.js";
import { buildSuggestions, GROUP_LABELS } from "./suggestions.js";
import { registerCommandLine } from "./commandLine.js";
import { openHelp } from "./help.js";
import { useLayer } from "../ui/useLayer.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toast } from "../ui/toasts.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { useSearch } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { settings, setSetting } from "../stores/settings.js";
import { navigate, pathFor } from "../router/index.jsx";
import { Change } from "../ui/Change.jsx";
import { fmtNum } from "../lib/format.js";

const THEME_CYCLE = { dark: "light", light: "system", system: "dark" };

function runCommand(command) {
  if (command === "theme") {
    const next = THEME_CYCLE[settings.get().theme] || "dark";
    setSetting("theme", next);
    toast({ title: `THEME · ${next.toUpperCase()}` });
  } else if (command === "density") {
    const next = settings.get().density === "compact" ? "comfortable" : "compact";
    setSetting("density", next);
    toast({ title: `DENSITY · ${next.toUpperCase()}` });
  } else if (command === "help") {
    openHelp();
  }
}

export function CommandLine() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const pool = useQuotePool();
  const watch = useStore(watchlist, (s) => s.symbols);
  const quickLook = useQuickLook();

  const parsed = useMemo(() => parseCommand(value), [value]);
  const searchQuery = parsed.kind === "search" && parsed.query.length >= 2 ? parsed.query : "";
  const { results: yahoo, loading: searching } = useSearch(searchQuery, 400);
  const items = useMemo(
    () => buildSuggestions({ value, parsed, poolList: pool.equities, watch, yahoo }),
    [value, parsed, pool.equities, watch, yahoo]
  );

  useEffect(() => { setActive(0); }, [value]);

  useEffect(() => registerCommandLine((prefill) => {
    setValue(prefill);
    setOpen(true);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }), []);

  const reset = () => { setOpen(false); setValue(""); if (inputRef.current) inputRef.current.blur(); };
  useLayer(open, reset);

  const runItem = (item, shift) => {
    reset();
    if (item.kind === "function") navigate(pathFor(item.routeName, item.params, item.query));
    else if (item.kind === "command") runCommand(item.command);
    else if (shift) quickLook.open(item.symbol);
    else navigate(pathFor("equities", { symbol: item.symbol }));
  };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Escape") { e.preventDefault(); reset(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (parsed.kind === "navigate") { reset(); navigate(pathFor(parsed.name, parsed.params, parsed.query)); }
      else if (parsed.kind === "command") { reset(); runCommand(parsed.command); }
      else if (items[active]) runItem(items[active], e.shiftKey);
    }
  };

  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.kind === item.kind) last.items.push(item);
    else groups.push({ kind: item.kind, items: [item] });
  }
  let flat = -1;

  return (
    <div className={`pb-cmd${open ? " pb-cmd--open" : ""}`}>
      <input
        ref={inputRef}
        className="pb-cmd__input"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="FUNCTION OR SYMBOL"
        aria-label="Command line"
        role="combobox"
        aria-expanded={open}
        aria-controls="pb-cmd-list"
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `pb-cmd-opt-${active}` : undefined}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
      />
      <span className="pb-cmd__go" aria-hidden="true">GO</span>
      {open && (
        <div className="pb-cmd__pop" id="pb-cmd-list" role="listbox">
          {groups.length === 0 && (
            <div className="pb-cmd__group"><div className="pb-cmd__empty pb-muted">{searching ? "SEARCHING…" : "NO MATCH"}</div></div>
          )}
          {groups.map((g) => (
            <div key={g.kind} className="pb-cmd__group">
              <div className="pb-cmd__grouplbl">{GROUP_LABELS[g.kind]}{g.kind === "search" && searching ? " · SEARCHING…" : ""}</div>
              {g.items.map((item) => {
                flat += 1;
                const idx = flat;
                const on = idx === active;
                return (
                  <div
                    key={item.id}
                    id={`pb-cmd-opt-${idx}`}
                    role="option"
                    aria-selected={on}
                    className={`pb-cmd__opt${on ? " pb-cmd__opt--on" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); runItem(item, e.shiftKey); }}
                    onMouseEnter={() => setActive(idx)}
                  >
                    <span className="pb-cmd__optlbl">{item.label}</span>
                    <span className="pb-cmd__optsub pb-muted">{item.sub}</span>
                    <span className="pb-cmd__optright">
                      {item.price > 0 && <>{fmtNum(item.price)} <Change value={item.changePercent} /></>}
                      {!(item.price > 0) && item.right && <span className="pb-muted">{item.right}</span>}
                      <span className="pb-cmd__hint pb-muted">{item.kind === "function" ? "GO" : item.kind === "command" ? "GO" : "GO · ⇧ QUICK LOOK"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/shell/ShortcutSheet.jsx`:
```jsx
import { useRef } from "react";
import { X } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { help, closeHelp, SHORTCUTS } from "./help.js";
import { useLayer } from "../ui/useLayer.js";
import { useFocusTrap } from "../ui/focusTrap.js";
import { Kbd } from "../ui/Kbd.jsx";

export function ShortcutSheet() {
  const open = useStore(help, (s) => s.open);
  const ref = useRef(null);
  useLayer(open, closeHelp);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div className="pb-scrim pb-scrim--center" onMouseDown={(e) => { if (e.target === e.currentTarget) closeHelp(); }}>
      <div ref={ref} className="pb-sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabIndex={-1}>
        <header className="pb-drawer__head">
          <span className="pb-drawer__title">KEYBOARD</span>
          <button type="button" className="pb-reset pb-drawer__close" aria-label="Close" onClick={closeHelp}><X size={14} strokeWidth={1.5} /></button>
        </header>
        <div className="pb-sheet__body">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="pb-kv"><span className="pb-kv__k"><Kbd>{key}</Kbd></span><span className="pb-kv__v pb-dim">{what}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Append the command line styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Command line, shortcut sheet
   ============================================================ */
.pb-cmd { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; max-width: 420px; height: calc(var(--top-h) - 8px); border: 1px solid var(--c-line-strong); background: var(--c-raised); }
.pb-cmd--open, .pb-cmd:focus-within { border-color: var(--c-accent); }
.pb-cmd__input { flex: 1; min-width: 0; height: 100%; padding: 0 8px; color: var(--c-accent-text); font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.04em; }
.pb-cmd__input::placeholder { color: var(--c-text-muted); text-transform: uppercase; }
.pb-cmd__go { padding: 0 8px; font-size: var(--fs-xs); color: var(--c-text-muted); letter-spacing: 0.06em; border-left: 1px solid var(--c-line); height: 100%; display: inline-flex; align-items: center; }
.pb-cmd__pop { position: absolute; top: calc(100% + 1px); left: -1px; right: -1px; max-height: min(60vh, 480px); overflow: auto; background: var(--c-raised); border: 1px solid var(--c-line-strong); z-index: var(--z-layer); }
.pb-cmd__grouplbl { padding: 4px 8px; font-size: var(--fs-xs); letter-spacing: 0.08em; color: var(--c-text-muted); border-bottom: 1px solid var(--c-line); background: var(--c-bg); position: sticky; top: 0; }
.pb-cmd__opt { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 8px; align-items: center; min-height: var(--row-h); padding: 0 8px; cursor: pointer; border-bottom: 1px solid var(--c-line); font-size: var(--fs-sm); }
.pb-cmd__opt--on { background: var(--c-selected); box-shadow: inset 2px 0 0 var(--c-accent); }
.pb-cmd__optlbl { font-weight: 600; }
.pb-cmd__optsub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-cmd__optright { display: inline-flex; gap: 8px; align-items: center; white-space: nowrap; }
.pb-cmd__hint { font-size: var(--fs-xs); letter-spacing: 0.06em; }
.pb-cmd__empty { padding: 8px; font-size: var(--fs-sm); }
@media (max-width: 767px) {
  .pb-cmd { max-width: none; }
  .pb-cmd__pop { position: fixed; left: 0; right: 0; top: var(--top-h); max-height: 70vh; }
  .pb-cmd__hint { display: none; }
}
.pb-sheet { width: 480px; max-width: calc(100vw - 24px); max-height: 80vh; overflow: auto; background: var(--c-raised); border: 1px solid var(--c-line-strong); animation: pb-rise var(--t-fast); }
.pb-sheet__body { padding: var(--cell-py) 0; }
```

- [ ] **Step 7: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "shell: command line with Bloomberg grammar, global keys, shortcut sheet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Top bar, sidebar, tape, mobile tabs, offline banner, app shell

**Files:**
- Create: `src/shell/Clock.jsx`, `src/shell/SessionClock.jsx`, `src/shell/AlertsBell.jsx`, `src/shell/TopBar.jsx`, `src/shell/Sidebar.jsx`, `src/shell/BottomTape.jsx`, `src/shell/MobileTabs.jsx`, `src/shell/OfflineBanner.jsx`, `src/shell/AppShell.jsx`
- Modify: `src/theme/index.css` (append "Shell" block before LEGACY)

- [ ] **Step 1: Create the components**

`src/shell/Clock.jsx`:
```jsx
import { useNow } from "../ui/useNow.js";
import { fmtClock } from "../lib/format.js";

export function Clock() {
  const now = useNow();
  return <span className="pb-clock" aria-label="Local time">{fmtClock(new Date(now))}</span>;
}
```

`src/shell/SessionClock.jsx`:
```jsx
import { useMemo, useState } from "react";
import { useNow } from "../ui/useNow.js";
import { useLayer } from "../ui/useLayer.js";
import { useQuote } from "../data/quotePool.jsx";
import { nyseSession, stateFromMarketState, SESSION_LABELS, WORLD_CLOCKS } from "../lib/session.js";
import { fmtClock, fmtCountdown } from "../lib/format.js";

// NYSE state with a countdown; click for New York, London, Tokyo clocks.
export function SessionClock({ compact = false }) {
  const now = useNow();
  const spx = useQuote("^GSPC");
  const session = useMemo(() => nyseSession(new Date(now)), [now]);
  const state = stateFromMarketState(spx ? spx.marketState : undefined) ?? session.state;
  const [open, setOpen] = useState(false);
  useLayer(open, () => setOpen(false));
  const remaining = session.countdownTo.getTime() - now;
  return (
    <div className="pb-session">
      <button type="button" className="pb-reset pb-session__btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Session and world clocks">
        <span className={`pb-session__dot pb-session__dot--${state}`} aria-hidden="true" />
        <span className="pb-session__label">{compact ? state.toUpperCase() : SESSION_LABELS[state]}</span>
        {!compact && <span className="pb-session__cd pb-muted">{session.countdownLabel} {fmtCountdown(remaining)}</span>}
      </button>
      {open && (
        <div className="pb-pop pb-session__pop" role="dialog" aria-label="World clocks">
          {WORLD_CLOCKS.map((c) => (
            <div key={c.tz} className="pb-kv"><span className="pb-kv__k">{c.label}</span><span className="pb-kv__v">{fmtClock(new Date(now), c.tz)}</span></div>
          ))}
          <div className="pb-kv"><span className="pb-kv__k">NYSE</span><span className="pb-kv__v">{SESSION_LABELS[state]} · {session.countdownLabel} {fmtCountdown(remaining)}</span></div>
          {session.early && <div className="pb-session__note pb-warn">EARLY CLOSE 13:00 ET</div>}
        </div>
      )}
    </div>
  );
}
```

`src/shell/AlertsBell.jsx`:
```jsx
import { useState } from "react";
import { Bell } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { alerts, rearmAlert, removeAlert } from "../stores/alerts.js";
import { useLayer } from "../ui/useLayer.js";
import { fmtNum, fmtClock } from "../lib/format.js";

export function AlertsBell() {
  const items = useStore(alerts, (s) => s.items);
  const [open, setOpen] = useState(false);
  useLayer(open, () => setOpen(false));
  const armed = items.filter((a) => !a.triggeredAt);
  const fired = items.filter((a) => a.triggeredAt);
  return (
    <div className="pb-bell">
      <button
        type="button"
        className={`pb-reset pb-bell__btn${fired.length ? " pb-bell__btn--fired" : ""}`}
        aria-label={`Alerts: ${armed.length} armed, ${fired.length} triggered`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={13} strokeWidth={1.5} />
        {items.length > 0 && <span className="pb-bell__count">{fired.length ? `${fired.length}!` : armed.length}</span>}
      </button>
      {open && (
        <div className="pb-pop pb-bell__pop" role="dialog" aria-label="Alerts">
          <div className="pb-pop__head">ALERTS<span className="pb-muted">{items.length ? `${armed.length} ARMED · ${fired.length} FIRED` : "NONE"}</span></div>
          {!items.length && <div className="pb-pop__empty pb-muted">Set one from any quick look (bell icon).</div>}
          {items.map((a) => (
            <div key={a.id} className="pb-alertrow">
              <span className="pb-alertrow__sym">{a.symbol}</span>
              <span className="pb-alertrow__cond">{a.op === "above" ? "≥" : "≤"} {fmtNum(a.price)}</span>
              <span className={`pb-alertrow__state ${a.triggeredAt ? "pb-warn" : "pb-muted"}`}>
                {a.triggeredAt ? `FIRED ${fmtClock(new Date(a.triggeredAt))}` : `LAST ${a.lastPrice != null ? fmtNum(a.lastPrice) : "—"}`}
              </span>
              {a.triggeredAt && <button type="button" className="pb-reset pb-alertrow__act" onClick={() => rearmAlert(a.id, a.triggeredPrice)}>RE-ARM</button>}
              <button type="button" className="pb-reset pb-alertrow__act pb-down" onClick={() => removeAlert(a.id)} aria-label={`Delete alert ${a.symbol}`}>DEL</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/shell/TopBar.jsx`:
```jsx
import { Link, useRoute } from "../router/index.jsx";
import { useIsMobile } from "../data/hooks.js";
import { CommandLine } from "./CommandLine.jsx";
import { AlertsBell } from "./AlertsBell.jsx";
import { SessionClock } from "./SessionClock.jsx";
import { Clock } from "./Clock.jsx";

export function TopBar() {
  const { route } = useRoute();
  const isMobile = useIsMobile(768);
  return (
    <header className="pb-top" role="banner">
      <Link to="/" className="pb-top__brand" aria-label="Purpleberg, dashboard">
        <span className="pb-top__mark" aria-hidden="true" />PURPLEBERG
      </Link>
      {!isMobile && (
        <span className="pb-top__crumb">
          <span className="pb-accent">{route ? route.mnemonic : "?"}</span>
          <span className="pb-muted"> · </span>
          {route ? route.label : "Unknown function"}
        </span>
      )}
      <CommandLine />
      <AlertsBell />
      <SessionClock compact={isMobile} />
      {!isMobile && <Clock />}
    </header>
  );
}
```

`src/shell/Sidebar.jsx`:
```jsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useRoute, ROUTES, pathFor } from "../router/index.jsx";
import { useIsMobile } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { ui, toggleSidebar } from "../stores/ui.js";

// Label plus mnemonic per screen; collapsed shows only the mnemonic.
export function Sidebar() {
  const { route } = useRoute();
  const collapsedPref = useStore(ui, (s) => s.sidebarCollapsed);
  const isTablet = useIsMobile(1024);
  const collapsed = collapsedPref || isTablet;
  return (
    <nav className={`pb-side${collapsed ? " pb-side--collapsed" : ""}`} aria-label="Functions">
      <ul className="pb-side__list">
        {ROUTES.map((r) => {
          const active = route ? route.name === r.name : false;
          return (
            <li key={r.name}>
              <Link
                to={pathFor(r.name)}
                className={`pb-side__item${active ? " pb-side__item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? `${r.mnemonic} · ${r.label}` : r.title}
              >
                {!collapsed && <span className="pb-side__label">{r.label}</span>}
                <span className="pb-side__mn">{r.mnemonic}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!isTablet && (
        <button type="button" className="pb-reset pb-side__toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={12} strokeWidth={1.5} /> : <ChevronLeft size={12} strokeWidth={1.5} />}
        </button>
      )}
    </nav>
  );
}
```

`src/shell/BottomTape.jsx`:
```jsx
import { useMemo } from "react";
import { useQuotePool } from "../data/quotePool.jsx";
import { Price } from "../ui/Price.jsx";
import { Change } from "../ui/Change.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { fmtNum } from "../lib/format.js";

// Scrolling tape of the 20 largest tracked names plus the status cluster.
export function BottomTape() {
  const pool = useQuotePool();
  const tape = useMemo(
    () => pool.equities.filter((q) => q.price > 0).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, 20),
    [pool.equities]
  );
  return (
    <footer className="pb-tape" aria-label="Price tape and feed status">
      <div className="pb-tape__viewport">
        <div className="pb-tape__scroll" style={{ animationPlayState: tape.length ? "running" : "paused" }}>
          {[...tape, ...tape].map((q, i) => (
            <span key={`${q.symbol}-${i}`} className="pb-tape__item">
              <span className="pb-muted">{q.symbol}</span>
              <Price value={q.price} format={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} />
              <Change value={q.changePercent} />
            </span>
          ))}
        </div>
      </div>
      <div className="pb-tape__status">
        <span>{pool.equities.length} QUOTES</span>
        <span className="pb-muted">·</span>
        <Freshness updatedAt={pool.updatedAt} intervalMs={pool.intervalMs} />
      </div>
    </footer>
  );
}
```

`src/shell/MobileTabs.jsx`:
```jsx
import { useState } from "react";
import { Link, useRoute, ROUTES, pathFor, routeByName, MOBILE_TAB_NAMES } from "../router/index.jsx";
import { Drawer } from "../ui/Drawer.jsx";

export function MobileTabs() {
  const { route } = useRoute();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <nav className="pb-mtabs" aria-label="Primary">
        {MOBILE_TAB_NAMES.map((name) => {
          const r = routeByName(name);
          const active = route ? route.name === name : false;
          return (
            <Link key={name} to={pathFor(name)} className={`pb-mtabs__tab${active ? " pb-mtabs__tab--on" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="pb-mtabs__mn">{r.mnemonic}</span>
              <span className="pb-mtabs__lbl">{r.label}</span>
            </Link>
          );
        })}
        <button type="button" className={`pb-reset pb-mtabs__tab${menu ? " pb-mtabs__tab--on" : ""}`} onClick={() => setMenu(true)} aria-haspopup="dialog">
          <span className="pb-mtabs__mn">MENU</span>
          <span className="pb-mtabs__lbl">All</span>
        </button>
      </nav>
      <Drawer open={menu} onClose={() => setMenu(false)} title="FUNCTIONS">
        <ul className="pb-menu">
          {ROUTES.map((r) => (
            <li key={r.name}>
              <Link to={pathFor(r.name)} className={`pb-menu__item${route && route.name === r.name ? " pb-menu__item--on" : ""}`} onClick={() => setMenu(false)}>
                <span className="pb-menu__mn">{r.mnemonic}</span>
                <span>{r.label}</span>
                <span className="pb-muted pb-menu__title">{r.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}
```

`src/shell/OfflineBanner.jsx`:
```jsx
import { useEffect, useRef } from "react";
import { useStore } from "../stores/useStore.js";
import { feedStatus } from "../data/feedStatus.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { toast } from "../ui/toasts.js";
import { fmtClock } from "../lib/format.js";

export function OfflineBanner() {
  const status = useStore(feedStatus, (s) => s.status);
  const since = useStore(feedStatus, (s) => s.since);
  const pool = useQuotePool();
  const prev = useRef(status);
  useEffect(() => {
    if (prev.current === status) return;
    prev.current = status;
    if (status === "offline") toast({ tone: "warn", title: "DATA FEED OFFLINE", body: "Showing last known values." });
    else toast({ title: "DATA FEED BACK ONLINE" });
  }, [status]);
  if (status !== "offline") return null;
  return (
    <div className="pb-offline" role="alert">
      <span>DATA FEED UNREACHABLE{since ? ` SINCE ${fmtClock(new Date(since))}` : ""} · SHOWING LAST KNOWN VALUES</span>
      <button type="button" className="pb-reset pb-offline__retry" onClick={pool.refetch}>RETRY</button>
    </div>
  );
}
```

`src/shell/AppShell.jsx`:
```jsx
import { useIsMobile } from "../data/hooks.js";
import { TopBar } from "./TopBar.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { BottomTape } from "./BottomTape.jsx";
import { MobileTabs } from "./MobileTabs.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";
import { ShortcutSheet } from "./ShortcutSheet.jsx";
import { Toasts } from "../ui/Toasts.jsx";
import { DialogHost } from "../ui/Dialog.jsx";

export function AppShell({ children }) {
  const isMobile = useIsMobile(768);
  return (
    <div className="pb-app">
      <TopBar />
      <OfflineBanner />
      <div className="pb-app__body">
        {!isMobile && <Sidebar />}
        <main id="main" className="pb-app__main" tabIndex={-1}>{children}</main>
      </div>
      {isMobile ? <MobileTabs /> : <BottomTape />}
      <Toasts />
      <DialogHost />
      <ShortcutSheet />
    </div>
  );
}
```

- [ ] **Step 2: Append the Shell styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Shell
   ============================================================ */
.pb-app { display: flex; flex-direction: column; height: 100%; }
.pb-app__body { display: flex; flex: 1; min-height: 0; }
.pb-app__main { flex: 1; min-width: 0; overflow: auto; }

.pb-top { position: relative; z-index: var(--z-shell); display: flex; align-items: center; gap: 12px; height: var(--top-h); padding: 0 10px; border-bottom: 1px solid var(--c-line); flex-shrink: 0; }
.pb-top__brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: 0.12em; color: var(--c-text); white-space: nowrap; }
.pb-top__brand:hover { text-decoration: none; color: var(--c-accent-text); }
.pb-top__mark { width: 8px; height: 8px; background: var(--c-accent); }
.pb-top__crumb { font-size: var(--fs-sm); white-space: nowrap; }
.pb-clock { font-size: var(--fs-sm); color: var(--c-text-dim); white-space: nowrap; }

.pb-pop { position: absolute; top: calc(100% + 4px); right: 0; min-width: 240px; background: var(--c-raised); border: 1px solid var(--c-line-strong); z-index: var(--z-layer); animation: pb-rise var(--t-fast); }
.pb-pop__head { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; font-size: var(--fs-label); letter-spacing: 0.06em; color: var(--c-accent-text); border-bottom: 1px solid var(--c-line); }
.pb-pop__empty { padding: 10px 8px; font-size: var(--fs-sm); }

.pb-session { position: relative; }
.pb-session__btn { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); white-space: nowrap; height: var(--top-h); }
.pb-session__dot { width: 7px; height: 7px; background: var(--c-text-muted); }
.pb-session__dot--open { background: var(--c-up); }
.pb-session__dot--pre, .pb-session__dot--post { background: var(--c-warn); }
.pb-session__dot--closed { background: var(--c-down); }
.pb-session__cd { font-size: var(--fs-xs); }
.pb-session__pop { min-width: 280px; }
.pb-session__note { padding: 6px 8px; font-size: var(--fs-xs); letter-spacing: 0.06em; }

.pb-bell { position: relative; }
.pb-bell__btn { display: inline-flex; align-items: center; gap: 4px; height: var(--top-h); color: var(--c-text-muted); }
.pb-bell__btn:hover, .pb-bell__btn[aria-expanded="true"] { color: var(--c-text); }
.pb-bell__btn--fired { color: var(--c-warn); }
.pb-bell__count { font-size: var(--fs-xs); }
.pb-bell__pop { min-width: 340px; max-width: calc(100vw - 16px); }
.pb-alertrow { display: grid; grid-template-columns: 56px 1fr auto auto auto; gap: 8px; align-items: center; padding: 0 8px; min-height: var(--row-h); font-size: var(--fs-sm); border-bottom: 1px solid var(--c-line); }
.pb-alertrow:last-child { border-bottom: 0; }
.pb-alertrow__sym { font-weight: 600; }
.pb-alertrow__state { font-size: var(--fs-xs); white-space: nowrap; }
.pb-alertrow__act { font-size: var(--fs-xs); letter-spacing: 0.06em; color: var(--c-accent-text); }

.pb-side { display: flex; flex-direction: column; width: var(--side-w); flex-shrink: 0; border-right: 1px solid var(--c-line); overflow: hidden; transition: width var(--t-fast); }
.pb-side--collapsed { width: var(--side-w-collapsed); }
.pb-side__list { list-style: none; flex: 1; overflow-y: auto; }
.pb-side__item { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: var(--row-h); padding: 0 10px; color: var(--c-text-dim); font-size: var(--fs-sm); white-space: nowrap; }
.pb-side__item:hover { background: var(--c-hover); color: var(--c-text); text-decoration: none; }
.pb-side__item--active { color: var(--c-text); background: var(--c-selected); box-shadow: inset 2px 0 0 var(--c-accent); }
.pb-side__mn { font-size: var(--fs-xs); letter-spacing: 0.06em; color: var(--c-text-muted); }
.pb-side__item--active .pb-side__mn { color: var(--c-accent-text); }
.pb-side--collapsed .pb-side__item { justify-content: center; padding: 0; }
.pb-side--collapsed .pb-side__mn { font-size: var(--fs-xs); }
.pb-side__toggle { display: flex; align-items: center; justify-content: center; height: var(--row-h); color: var(--c-text-muted); border-top: 1px solid var(--c-line); }
.pb-side__toggle:hover { color: var(--c-text); }

.pb-tape { position: relative; z-index: var(--z-shell); display: flex; align-items: center; height: var(--tape-h); border-top: 1px solid var(--c-line); font-size: var(--fs-xs); flex-shrink: 0; overflow: hidden; }
.pb-tape__viewport { flex: 1; min-width: 0; overflow: hidden; }
.pb-tape__scroll { display: inline-flex; gap: 20px; white-space: nowrap; padding-left: 10px; animation: pb-tape 75s linear infinite; }
.pb-tape__scroll:hover { animation-play-state: paused; }
.pb-tape__item { display: inline-flex; gap: 6px; }
.pb-tape__status { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px 0 16px; border-left: 1px solid var(--c-line); background: var(--c-bg); white-space: nowrap; color: var(--c-text-dim); letter-spacing: 0.04em; }

.pb-mtabs { position: relative; z-index: var(--z-shell); display: flex; height: 52px; border-top: 1px solid var(--c-line); padding-bottom: env(safe-area-inset-bottom, 0px); flex-shrink: 0; }
.pb-mtabs__tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--c-text-muted); min-height: 44px; }
.pb-mtabs__tab:hover { text-decoration: none; }
.pb-mtabs__tab--on { color: var(--c-text); box-shadow: inset 0 2px 0 var(--c-accent); }
.pb-mtabs__mn { font-size: var(--fs-xs); letter-spacing: 0.08em; }
.pb-mtabs__lbl { font-size: var(--fs-xs); }
.pb-menu { list-style: none; }
.pb-menu__item { display: grid; grid-template-columns: 52px 1fr; column-gap: 8px; align-items: center; padding: 8px var(--cell-px); min-height: 44px; color: var(--c-text); border-bottom: 1px solid var(--c-line); }
.pb-menu__item:hover { text-decoration: none; background: var(--c-hover); }
.pb-menu__item--on { background: var(--c-selected); box-shadow: inset 2px 0 0 var(--c-accent); }
.pb-menu__mn { font-size: var(--fs-xs); letter-spacing: 0.06em; color: var(--c-accent-text); grid-row: span 2; }
.pb-menu__title { font-size: var(--fs-xs); }

.pb-offline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 10px; font-size: var(--fs-xs); letter-spacing: 0.06em; color: var(--c-warn); border-bottom: 1px solid var(--c-warn); background: var(--c-bg); }
.pb-offline__retry { color: var(--c-warn); border: 1px solid var(--c-warn); padding: 1px 6px; }

.pb-error { margin: var(--sec-pad); padding: var(--sec-pad); border: 1px solid var(--c-down); }
.pb-error__title { font-size: var(--fs-label); letter-spacing: 0.06em; color: var(--c-down); margin-bottom: 6px; }
.pb-error__msg { font-size: var(--fs-sm); color: var(--c-text-dim); margin-bottom: 10px; }
.pb-error__stack { font-size: var(--fs-xs); color: var(--c-text-muted); background: var(--c-raised); border: 1px solid var(--c-line); padding: 8px; max-height: 180px; overflow: auto; white-space: pre-wrap; margin-bottom: 10px; }
```

- [ ] **Step 3: Build and commit**

Run: `npx vite build` → `✓ built in`.

```bash
git add -A
git commit -m "shell: top bar with session clock and alerts, mnemonic sidebar, tape, mobile tabs, offline banner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Wire the app: router, providers, adapters for old screens, delete the old shell

**Files:**
- Rewrite: `src/App.jsx`
- Modify: `src/main.jsx`
- Modify: `src/ErrorBoundary.jsx` (render method)
- Delete: `src/components/TopBar.jsx`, `src/components/Sidebar.jsx`, `src/components/BottomBar.jsx`, `src/components/CommandPalette.jsx`, `src/components/MobileMenu.jsx`, `src/components/Clock.jsx`, `src/navConfig.jsx`, `src/screens/RiskAnalytics.jsx`
- Modify: `src/theme/index.css` (remove the `LEGACY SHELL` lines)

- [ ] **Step 1: Rewrite `src/App.jsx`**

```jsx
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { useRoute, navigate, pathFor, routeByMnemonic } from "./router/index.jsx";
import { AppShell } from "./shell/AppShell.jsx";
import { installKeyboard } from "./shell/keyboard.js";
import { useAlertsEngine } from "./features/useAlertsEngine.js";
import { useNewsFeed } from "./features/newsFeed.jsx";
import { useQuotePool } from "./data/quotePool.jsx";
import { settings } from "./stores/settings.js";
import { Loading } from "./ui/Loading.jsx";
import { toast } from "./ui/toasts.js";
import ErrorBoundary from "./ErrorBoundary";

// Screens are code-split. The ones marked "old" are the pre-redesign screens,
// replaced one by one in Plans P2 and P3.
const MarketDashboard = lazy(() => import("./screens/MarketDashboard")); // old
const EquityAnalysis = lazy(() => import("./screens/EquityAnalysis")); // old
const FXDashboard = lazy(() => import("./screens/FXDashboard")); // old
const FixedIncome = lazy(() => import("./screens/FixedIncome")); // old
const CommoditiesDashboard = lazy(() => import("./screens/CommoditiesDashboard")); // old
const CryptoDashboard = lazy(() => import("./screens/CryptoDashboard")); // old
const StockScreener = lazy(() => import("./screens/StockScreener")); // old
const PortfolioManager = lazy(() => import("./screens/PortfolioManager")); // old
const EconomicCalendar = lazy(() => import("./screens/EconomicCalendar")); // old
const NewsCenter = lazy(() => import("./screens/NewsCenter")); // old
const CompareStocks = lazy(() => import("./screens/CompareStocks")); // old
const IpoCenter = lazy(() => import("./screens/IpoCenter")); // old
const Settings = lazy(() => import("./screens/Settings.jsx"));

const noop = () => {};

function useDefaultScreen() {
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const { defaultScreen } = settings.get();
    if (window.location.pathname === "/" && !window.location.search && defaultScreen && defaultScreen !== "WEI") {
      const r = routeByMnemonic(defaultScreen);
      if (r) navigate(pathFor(r.name), { replace: true });
    }
  }, []);
}

function Screen({ route, params }) {
  const pool = useQuotePool();
  const { news, loading: newsLoading } = useNewsFeed();
  // Old screens expect the tracked-equity list only; the pool excludes index rows.
  const list = pool.equities;
  switch (route ? route.name : "dashboard") {
    case "equities": return <EquityAnalysis allStockQuotes={list} initialSymbol={params.symbol || null} onSymbolConsumed={noop} />;
    case "screener": return <StockScreener allStockQuotes={list} />;
    case "compare": return <CompareStocks allStockQuotes={list} news={news} />;
    case "fx": return <FXDashboard />;
    case "rates": return <><FixedIncome /><EconomicCalendar /></>;
    case "commodities": return <CommoditiesDashboard />;
    case "crypto": return <CryptoDashboard />;
    case "ipos": return <IpoCenter />;
    case "portfolio": return <PortfolioManager />;
    case "news": return <NewsCenter news={news} loading={newsLoading} />;
    case "settings": return <Settings />;
    default: return <MarketDashboard allStockQuotes={list} news={news} />;
  }
}

export default function App() {
  const { route, params, path } = useRoute();
  useAlertsEngine();
  useDefaultScreen();
  useEffect(() => installKeyboard(), []);
  useEffect(() => {
    if (!route) toast({ tone: "warn", title: "UNKNOWN FUNCTION", body: path });
  }, [route, path]);

  return (
    <AppShell>
      <ErrorBoundary key={route ? route.name : "unknown"} screen={route ? route.mnemonic : ""}>
        <Suspense fallback={<Loading />}>
          <Screen route={route} params={params} />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
```

- [ ] **Step 2: Providers in `src/main.jsx`**

```jsx
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { startThemeSync } from "./theme/applyTheme.js";
import { ThemeProvider } from "./ThemeContext";
import { QuotePoolProvider } from "./data/quotePool.jsx";
import { NewsProvider } from "./features/newsFeed.jsx";
import { QuickLookProvider } from "./features/quickLook.jsx";
import App from "./App";

startThemeSync();

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <QuotePoolProvider>
      <NewsProvider>
        <QuickLookProvider>
          <App />
        </QuickLookProvider>
      </NewsProvider>
    </QuotePoolProvider>
  </ThemeProvider>
);
```

- [ ] **Step 3: Restyle the error boundary**

In `src/ErrorBoundary.jsx` replace the `return (` block inside `render()` (everything after `const isDev = …;`) with:

```jsx
    return (
      <div className="pb-error" role="alert">
        <div className="pb-error__title">SCREEN ERROR{this.props.screen ? ` · ${this.props.screen}` : ""}</div>
        <div className="pb-error__msg">
          This screen crashed while rendering. The rest of the terminal still works: pick another function or retry this one.
        </div>
        <div className="pb-error__stack">
          {String(error?.message || error)}
          {isDev && info?.componentStack ? "\n" + info.componentStack : ""}
        </div>
        <button type="button" className="pb-button pb-button--primary" onClick={this.handleReset}>RETRY</button>
      </div>
    );
```

- [ ] **Step 4: Delete the old shell and the orphaned screen**

Run:
```bash
git rm -q -r src/components src/navConfig.jsx src/screens/RiskAnalytics.jsx
```

In `src/theme/index.css` delete the nine lines from `/* LEGACY SHELL - deleted in Task 16 with src/components */` through `.pb-search-pill { … }`.

- [ ] **Step 5: Confirm nothing still imports the deleted modules**

Run:
```bash
grep -rn "navConfig\|components/\|RiskAnalytics" src --include=*.jsx --include=*.js
```
Expected: no output.

- [ ] **Step 6: Tests and build**

Run: `npm test` → `fail 0`.
Run: `npx vite build` → `✓ built in`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "app: router-driven shell with quote pool, quick-look, alerts; old screens behind adapters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: `/api/status`, Settings screen, version

**Files:**
- Modify: `server/index.js` (insert the route after `import fs from "fs";`)
- Modify: `vite.config.js`, `package.json`
- Create: `src/screens/Settings.jsx`
- Modify: `src/theme/index.css` (append "Settings" block before LEGACY)

- [ ] **Step 1: Add the status endpoint**

In `server/index.js`, directly after the line `import fs from "fs";` (inside the "Serve static files" section) insert:

```js
// ── GET /api/status ─────────────────────────────────────
// Which optional integrations are configured. Booleans only, never the keys.
const APP_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")).version;
app.get("/api/status", apiLimiter, (req, res) => {
  res.json({
    version: APP_VERSION,
    finnhub: Boolean(FINNHUB_API_KEY),
    coingecko: Boolean(CG_API_KEY),
  });
});
```

(`FINNHUB_API_KEY` and `CG_API_KEY` are already defined higher in the file; `import` declarations are hoisted, so `fs` is available.)

- [ ] **Step 2: Version**

In `package.json` change `"version": "1.0.0"` to `"version": "3.0.0"`.

Replace `vite.config.js` with:

```js
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 3: Create `src/screens/Settings.jsx`**

```jsx
import { useEffect, useRef, useState } from "react";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { Select } from "../ui/Select.jsx";
import { Button } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Tag } from "../ui/Tag.jsx";
import { toast } from "../ui/toasts.js";
import { confirm } from "../ui/dialog.js";
import { useStore } from "../stores/useStore.js";
import { settings, setSetting, THEMES, DENSITIES, REFRESH_OPTIONS } from "../stores/settings.js";
import { watchlist, addSymbol, removeSymbol, moveSymbol, normalizeSymbol, WATCHLIST_MAX } from "../stores/watchlist.js";
import { exportAll, importAll, resetAll } from "../stores/index.js";
import { ROUTES } from "../router/routes.js";
import { api } from "../data/api.js";

const DATA_SOURCES = [
  { name: "Yahoo Finance (unofficial)", what: "Quotes, history, fundamentals, news, search" },
  { name: "CoinGecko, CoinPaprika fallback", what: "Crypto markets and history" },
  { name: "Forex Factory", what: "Economic calendar" },
  { name: "open.er-api.com", what: "Daily FX fallback rates" },
  { name: "Finnhub (optional key)", what: "Live IPO calendar" },
];

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export default function Settings() {
  const s = useStore(settings);
  const symbols = useStore(watchlist, (st) => st.symbols);
  const [newSym, setNewSym] = useState("");
  const [status, setStatus] = useState(null);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const fileRef = useRef(null);

  useEffect(() => {
    let on = true;
    api.status().then((r) => { if (on) setStatus(r); }).catch(() => { if (on) setStatus({ error: true }); });
    return () => { on = false; };
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") setSetting("notifications", true);
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purpleberg-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "DATA EXPORTED" });
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ok = await confirm({ title: "IMPORT DATA", body: "Replace your watchlist, alerts, portfolio, saved screens, and settings with the file contents?", confirmLabel: "IMPORT" });
      if (!ok) return;
      const res = importAll(data);
      toast(res.ok ? { title: "DATA IMPORTED" } : { tone: "warn", title: "IMPORT FAILED", body: res.error });
    } catch {
      toast({ tone: "warn", title: "IMPORT FAILED", body: "Not valid JSON" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doReset = async () => {
    const ok = await confirm({ title: "RESET ALL LOCAL DATA", body: "Watchlist, alerts, portfolio, saved screens, and settings go back to defaults. This cannot be undone.", confirmLabel: "RESET", danger: true });
    if (ok) { resetAll(); toast({ title: "LOCAL DATA RESET" }); }
  };

  const addWatch = (e) => {
    e.preventDefault();
    const sym = normalizeSymbol(newSym);
    if (!sym) { toast({ tone: "warn", title: "INVALID SYMBOL" }); return; }
    addSymbol(sym);
    setNewSym("");
  };

  const keyTag = (configured, offLabel) => (
    status ? (status.error ? "—" : <Tag tone={configured ? "up" : undefined}>{configured ? "CONFIGURED" : offLabel}</Tag>) : "…"
  );

  return (
    <Page>
      <Grid cols="1fr 1fr" colsMobile="1fr">
        <Section mnemonic="SET" title="Appearance">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">THEME</span>
              <Segmented label="Theme" value={s.theme} onChange={(v) => setSetting("theme", v)} options={THEMES.map((t) => ({ value: t, label: t.toUpperCase() }))} />
            </div>
            <div className="pb-form__row">
              <span className="pb-form__label">DENSITY</span>
              <Segmented label="Density" value={s.density} onChange={(v) => setSetting("density", v)} options={DENSITIES.map((d) => ({ value: d, label: d.toUpperCase() }))} />
            </div>
          </div>
        </Section>

        <Section title="Data">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">REFRESH</span>
              <Segmented label="Refresh rate" value={String(s.refreshSec)} onChange={(v) => setSetting("refreshSec", Number(v))} options={REFRESH_OPTIONS.map((r) => ({ value: String(r), label: `${r}S` }))} />
            </div>
            <div className="pb-form__row">
              <span className="pb-form__label">DEFAULT SCREEN</span>
              <Select aria-label="Default screen" value={s.defaultScreen} onChange={(v) => setSetting("defaultScreen", v)} options={ROUTES.map((r) => ({ value: r.mnemonic, label: `${r.mnemonic} · ${r.label}` }))} />
            </div>
            <div className="pb-form__hint pb-muted">Every poll scales with the refresh rate. 15s is what the proxy is tuned for.</div>
          </div>
        </Section>

        <Section title="Alerts">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">BROWSER NOTIFICATIONS</span>
              {perm === "granted" ? (
                <Segmented label="Notifications" value={s.notifications ? "on" : "off"} onChange={(v) => setSetting("notifications", v === "on")} options={[{ value: "on", label: "ON" }, { value: "off", label: "OFF" }]} />
              ) : perm === "denied" ? (
                <span className="pb-warn">BLOCKED IN BROWSER</span>
              ) : perm === "unsupported" ? (
                <span className="pb-muted">NOT SUPPORTED</span>
              ) : (
                <Button onClick={requestNotifications}>ENABLE</Button>
              )}
            </div>
            <div className="pb-form__hint pb-muted">Alerts always show in the app. Notifications also fire while the tab is in the background.</div>
          </div>
        </Section>

        <Section title="Watchlist" meta={`${symbols.length} / ${WATCHLIST_MAX}`}>
          <form className="pb-form__row" onSubmit={addWatch}>
            <Input mono value={newSym} onChange={(e) => setNewSym(e.target.value)} placeholder="ADD SYMBOL" aria-label="Add symbol" style={{ maxWidth: 160 }} />
            <Button type="submit" variant="primary">ADD</Button>
          </form>
          <ul className="pb-watchlist">
            {symbols.map((sym, i) => (
              <li key={sym} className="pb-watchlist__row">
                <span className="pb-muted">{i + 1})</span>
                <span className="pb-watchlist__sym">{sym}</span>
                <span className="pb-watchlist__tools">
                  <Button size="sm" onClick={() => moveSymbol(sym, -1)} disabled={i === 0} aria-label={`Move ${sym} up`}>▲</Button>
                  <Button size="sm" onClick={() => moveSymbol(sym, 1)} disabled={i === symbols.length - 1} aria-label={`Move ${sym} down`}>▼</Button>
                  <Button size="sm" variant="danger" onClick={() => removeSymbol(sym)} aria-label={`Remove ${sym}`}>DEL</Button>
                </span>
              </li>
            ))}
            {!symbols.length && <li className="pb-muted pb-watchlist__empty">Empty. Star any ticker to add it.</li>}
          </ul>
        </Section>

        <Section title="Storage">
          <div className="pb-form">
            <div className="pb-form__row">
              <Button onClick={doExport}>EXPORT JSON</Button>
              <Button onClick={() => fileRef.current && fileRef.current.click()}>IMPORT JSON</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="pb-sr-only" onChange={(e) => doImport(e.target.files && e.target.files[0])} aria-label="Import file" />
              <Button variant="danger" onClick={doReset}>RESET ALL</Button>
            </div>
            <div className="pb-form__hint pb-muted">Everything lives in this browser only: watchlist, alerts, portfolio, saved screens, settings.</div>
          </div>
        </Section>

        <Section title="About">
          <KVList>
            <KV k="VERSION" v={VERSION} />
            <KV k="BUILT BY" v="Rubayet Rezwan" />
            <KV k="FINNHUB KEY" v={keyTag(status && status.finnhub, "NOT SET")} />
            <KV k="COINGECKO KEY" v={keyTag(status && status.coingecko, "PUBLIC TIER")} />
          </KVList>
          <div className="pb-about">
            <div className="pb-label">DATA SOURCES</div>
            <ul className="pb-about__list">
              {DATA_SOURCES.map((d) => <li key={d.name}><span>{d.name}</span><span className="pb-muted">{d.what}</span></li>)}
            </ul>
            <div className="pb-about__disclaimer pb-muted">
              Educational project. Yahoo Finance endpoints are unofficial and not licensed for redistribution. Do not trade on this data.
            </div>
          </div>
        </Section>
      </Grid>
    </Page>
  );
}
```

- [ ] **Step 4: Append the Settings styles**

Insert before the LEGACY block in `src/theme/index.css`:

```css
/* ============================================================
   Settings
   ============================================================ */
.pb-form { display: flex; flex-direction: column; gap: 10px; }
.pb-form__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pb-form__label { min-width: 150px; font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); }
.pb-form__hint { font-size: var(--fs-sm); }
.pb-watchlist { list-style: none; margin-top: 8px; }
.pb-watchlist__row { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 8px; min-height: var(--row-h); border-bottom: 1px solid var(--c-line); }
.pb-watchlist__row:last-child { border-bottom: 0; }
.pb-watchlist__sym { font-weight: 600; }
.pb-watchlist__tools { display: inline-flex; gap: 4px; }
.pb-watchlist__empty { padding: 8px 0; font-size: var(--fs-sm); }
.pb-about { margin-top: 10px; }
.pb-about__list { list-style: none; margin: 4px 0 10px; }
.pb-about__list li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--c-line); font-size: var(--fs-sm); }
.pb-about__disclaimer { font-size: var(--fs-sm); line-height: 1.5; }
```

- [ ] **Step 5: Tests, build, and a live check of the endpoint**

Run: `npm test` → `fail 0`.
Run: `npx vite build` → `✓ built in`.
Start the backend with the Browser pane (`preview_start`, name `backend`), then run:
```bash
curl -s http://localhost:3001/api/status
```
Expected: `{"version":"3.0.0","finnhub":false,"coingecko":false}` (booleans depend on `.env`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "settings: appearance, data, alerts, watchlist, storage, about; /api/status; version 3.0.0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Verification pass

**Files:** none new. This task produces evidence, fixes anything found (each fix is its own small commit), and ticks the boxes.

- [ ] **Step 1: Unit tests and build**

Run: `npm test`
Expected: every suite passes (`fail 0`). Expected count: the 22 pre-existing tests plus 8 format, 7 store, 5 domain, 2 theme, 5 router, 4 data, 8 session, 7 alerts, 2 kit, 5 table, 1 layers, 1 toasts, 1 watch actions, 5 command = 83.

Run: `npx vite build`
Expected: `✓ built in`. Note the gzip size of the largest `dist/assets/index-*.js` chunk in the plan's commit message for P3 to compare against the baseline commit (`git stash`-free method: `git show 73cb96e --stat` is not needed; run `git checkout 73cb96e -- . && npx vite build` in a scratch worktree only if a comparison is wanted now; otherwise defer to P3).

- [ ] **Step 2: Start both servers through the Browser pane**

Use `preview_start` with `name: "backend"`, then `preview_start` with `name: "frontend"`. Open `http://localhost:5173/`.

- [ ] **Step 3: Shell checks (desktop, dark)**

For each item, read the page (`read_page` or `get_page_text`) and check `read_console_messages` with `onlyErrors: true` returns nothing new:

1. Top bar shows PURPLEBERG, `WEI · Dashboard`, the command line with GO, the bell, `NYSE …` with a countdown, and the clock.
2. Sidebar lists 12 entries with mnemonics; clicking `DES` changes the URL to `/equities` and the crumb to `DES · Equities`. Browser back returns to `/`.
3. Collapse the sidebar: only mnemonics remain; reload keeps it collapsed.
4. Type `des aapl` in the command line and press Enter: URL becomes `/equities/AAPL` and the old Equities screen selects AAPL.
5. Press `/`, type `nv`, Shift+Enter on NVDA: the quick-look drawer opens on the right with price, sparkline, stats, headlines. Esc closes it.
6. In quick-look press the star: toast "NVDA ADDED TO WATCHLIST" with UNDO; the Settings watchlist section shows it.
7. In quick-look press the bell, set ABOVE at a price below the current one: the note about "already above" appears; save; the bell in the top bar shows `1`. Set another alert BELOW at a price above current: on the next poll (15s) a sticky warn toast fires and the bell shows `1!`. RE-ARM clears it.
8. `?` opens the shortcut sheet; Esc closes it.
9. Tape scrolls at the bottom with `250 QUOTES · Ns ago`.
10. Navigate to `/nope`: the dashboard renders and a toast says UNKNOWN FUNCTION.
11. Settings: switch theme to LIGHT and density to COMFORTABLE; the whole app repaints; reload keeps both. Switch back.
12. Stop the backend (`preview_stop` on its serverId). Within two polls the amber banner appears and a toast says DATA FEED OFFLINE; values stay on screen. Start it again; the banner clears and a toast says BACK ONLINE.

- [ ] **Step 4: Mobile and tablet**

`resize_window` preset `mobile`, reload:
1. Bottom tabs WEI, DES, PORT, TOP, MENU; MENU opens the full list in a drawer.
2. Command line spans the top bar; suggestions open full width.
3. Quick-look drawer is full width; Esc or the X closes it.

`resize_window` width 900 height 800: the sidebar shows mnemonics only, with no toggle.

Reset with preset `desktop`.

- [ ] **Step 5: Screenshots**

Take `computer` screenshots of: dashboard (dark, desktop), Equities with quick-look open, Settings in light theme, dashboard at mobile width. Send them to the user with `SendUserFile`.

- [ ] **Step 6: Record and commit**

If any fix was needed, commit it with a `fix:` message. Then tick every checkbox in this plan and commit the plan file:

```bash
git add docs/superpowers/plans
git commit -m "docs: P1 foundation plan verified

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage in this plan:** 3 (tokens, kit, 3.4 rules in CSS and copy), 4 (kit), 5 (shell), 6 (router), 7.1 (stores), 7.2 (command line, keys), 7.4 (quick-look), 7.5 (alerts), 7.7 (freshness, offline), 7.8 (session clock), 7.10 (Settings), 7.11 (`/api/status`), 9 (data layer). Watchlist toggle on screens (7.3), screener presets (7.6), the screens themselves (8), and portfolio math (7.9) are Plans P2 and P3 by design.
- **Names used across tasks:** `useStore`, `createStore`, `memoryStorage`; `settings.setSetting`; `watchlist.addToList/removeFromList/normalizeSymbol`; `alerts.addAlert/removeAlert/rearmAlert/replaceAlertItems`; `useQuotePool/useQuote/usePoolExtra`; `feedStatus.reportPoll`; `pathFor/navigate/updateQuery/useRoute/Link`; `pushLayer/popLayer/closeTopLayer/useLayer`; `toast/dismissToast/getToasts`; `confirm/settleDialog/DialogHost`; `nyseSession/stateFromMarketState`; `evaluateAlerts/conditionHolds`; `parseCommand/buildSuggestions/registerCommandLine/focusCommandLine`; `openHelp/closeHelp`. Each is defined before it is used.
- **Legacy CSS block** stays until P2 deletes `src/shared.jsx` and the old screens; the `LEGACY SHELL` sub-block is removed in Task 16 of this plan.

## What comes next

- **Plan P2 (market screens):** Dashboard, Equities, Screener (presets, saved screens), Compare, FX, Rates & Macro, Commodities, Crypto, IPOs, News, plus `src/data/sparklines.js`, `src/lib/screener.js`, deletion of `src/shared.jsx`, `src/chartTheme.jsx`, `src/hooks.js`, `src/api.js`, the `config.js` re-exports, `ThemeContext.jsx`, and the LEGACY CSS block.
- **Plan P3 (portfolio and finish):** `src/lib/portfolio.js` with tests, the Portfolio screen (transactions, performance versus S&P 500, allocation, risk), README rewrite, bundle comparison, code-reviewer pass, merge. P3 must call `migratePortfolio()` once at the cutover from the old Portfolio screen, only when the new store is still empty.
