# Purpleberg Terminal: Terminal v3.0 redesign

**Date:** 2026-09-04
**Branch:** `redesign/terminal-v3`
**Supersedes:** `2026-06-26-glass-terminal-redesign-design.md` (Glass Fintech)
**Approach:** Primitive-first rebuild. Build a small component kit, a dependency-free router,
persistent stores, and a shared data layer first; then re-implement every screen on that kit,
deleting the old screen as each one lands; then thread the new features through.

## 1. Brief (locked with the user)

- **Purpose is unchanged.** Purpleberg stays a Bloomberg-style market terminal: dense,
  multi-panel, live, mnemonic-driven, spanning equities, FX, rates, commodities, crypto, IPOs,
  a screener, a portfolio, and news. "Minimal" means removing decoration, not data.
- **Direction A, "Terminal v3.0".** Flat, one surface tone, hairline separation, one accent
  colour, terminal density. Chosen over "Calm Dashboard" (cards, icon rail) and "Editorial"
  (borderless, big numbers), which was rejected for losing the terminal.
- **Typography follows the Bloomberg Terminal:** one monospaced family for every piece of
  text, uppercase labels and mnemonics, Enter as `<GO>`. The Terminal's own typeface is
  proprietary and cannot be used; the user picks the closest open font from four candidates
  (IBM Plex Mono is the default in this spec, see 3.2).
- **It must not read as AI-generated.** Section 3.4 lists the concrete rules: pure black
  canvas, hard edges, no gradients or glow, no emoji or decorative icons, terse terminal copy,
  numbered rows, `<GO>`.
- **Screens consolidate from 13 to 12.** Risk Analytics folds into Portfolio (real
  portfolio risk) and the Dashboard (breadth). Fixed Income and Economics merge into
  Rates & Macro. Settings is new.
- **Features added (all approved):** URL routing and deep links, keyboard-first navigation,
  market session clock, Settings, Watchlist, quick-look drawer, price alerts, portfolio
  upgrades, screener presets and saved screens, data-freshness indicators.
- **Features declined:** compare up to 4 symbols, dashboard sector heatmap.
- **No new runtime dependencies.** React 18, Vite, Recharts, Lucide, Express stay.
  The router, stores, drawer, toasts, and table virtualisation are written in-house.
- **Backend stays as is** except for one new read-only endpoint, `GET /api/status`.

## 2. Non-negotiable guardrails

1. Every data flow that exists today keeps working: all polling hooks, the Yahoo/CoinGecko
   proxy, the curated IPO list, the FX fallbacks, portfolio persistence (migrated, not lost).
2. Both themes, both densities, and three widths (375, 768, 1440) are verified per screen.
3. Accessibility is kept or improved: AA contrast, visible `:focus-visible`, `aria-current`
   on nav, `aria-sort` on sortable tables, dialog and drawer roles with focus trap and Esc,
   `prefers-reduced-motion` disables all non-essential motion.
4. The production bundle is not larger than today's.
5. Old code is deleted as it is replaced. No parallel "v1/v2" components at the end.

## 3. Visual system

### 3.1 Principles

- Pure black canvas, one tone for everything. Sections are separated by 1px hairlines, never
  by cards, shadows, blur, gradients, sheen, or glow. Floating layers (command-line dropdown,
  drawer, toasts, dialogs, selects) use a slightly raised tone and a 1px border. Nothing has a
  radius.
- One accent, used the way Bloomberg uses amber: section titles, the command-line text, the
  active nav item, the selected row, focus rings, links, and the primary button. It never fills
  backgrounds or paints large areas.
- Data colours are semantic only: up, down, warn (stale, offline, alerts). No gold, no cyan.
- One monospaced family for all text, with tabular figures. There is no sans-serif anywhere.
- Section headers are 11px uppercase accent-coloured labels with right-aligned muted meta,
  prefixed with the mnemonic when the section mirrors a function ("WEI  WORLD EQUITY INDICES").
- Motion only expresses state: 150ms transitions, 180ms drawer and command-line slide,
  a subtler price tick flash. No entrance stagger, pulses, or tape glow.

### 3.2 Tokens (`src/theme/index.css`)

Dark (default):

| Token | Value | Use |
|---|---|---|
| `--c-bg` | `#000000` | canvas and every section |
| `--c-raised` | `#0d0d0d` | floating layers only |
| `--c-line` | `#222222` | hairlines |
| `--c-line-strong` | `#3a3a3a` | inputs, floating-layer borders |
| `--c-text` | `#e8e8e8` | primary text |
| `--c-text-dim` | `#a3a3a3` | secondary text |
| `--c-text-muted` | `#7d7d7d` | labels, meta (4.7:1 on raised) |
| `--c-accent` | `#7c3aed` | active marker, focus, primary button fill (3.7:1 on black as a non-text marker; white text on it 5.7:1) |
| `--c-accent-text` | `#a78bfa` | section titles, command line, links (7.7:1 on black) |
| `--c-up` / `--c-down` | `#22c55e` / `#ef4444` | signed changes |
| `--c-warn` | `#f59e0b` | stale, offline, alerts |
| `--c-selected` | `rgba(139,92,246,.12)` | selected row fill |
| `--c-hover` | `rgba(255,255,255,.04)` | hover row fill |

Light ("paper"): `--c-bg #f4f4f1`, `--c-raised #ffffff`, `--c-line #d6d6d0`,
`--c-line-strong #b8b8b0`, `--c-text #161616`, `--c-text-dim #4a4a4a`, `--c-text-muted #6e6e6e`,
`--c-accent #6d28d9`, `--c-accent-text #5b21b6`, `--c-up #15803d`, `--c-down #b91c1c`,
`--c-warn #b45309`, `--c-selected rgba(109,40,217,.08)`, `--c-hover rgba(0,0,0,.03)`.

Theme is applied as `data-theme="dark|light"` on `<html>`; "system" resolves through
`prefers-color-scheme` and re-resolves on change. Density is `data-density="compact|comfortable"`.

Density tokens:

| Token | compact | comfortable |
|---|---|---|
| `--fs-base` | 12px | 13px |
| `--fs-sm` | 11px | 12px |
| `--fs-lg` | 14px | 15px |
| `--row-h` | 24px | 30px |
| `--cell-px` | 8px | 12px |
| `--cell-py` | 4px | 6px |
| `--sec-pad` | 10px | 14px |

Fixed tokens: `--fs-label 11px` (section labels), `--font-mono` (the only family, see below),
`--t-fast 150ms ease-out`, `--t-slide 180ms ease-out`, `--top-h 32px`, `--tape-h 22px`,
`--side-w 152px`, `--side-w-collapsed 44px`, `--drawer-w 360px`. There are no radius tokens:
every element is square.

Font: `--font-mono: "IBM Plex Mono", ui-monospace, Consolas, "Liberation Mono", monospace`
loaded from Google Fonts at weights 400, 500, 600 with `display=swap`. The family is the
user's pick among IBM Plex Mono, Ubuntu Mono, Roboto Mono, and JetBrains Mono; the spec
assumes IBM Plex Mono and the token is the only place that changes. Inter is removed from
`index.html`.

Breakpoints: mobile `< 768`, tablet `768–1023` (sidebar auto-collapses to mnemonics),
desktop `≥ 1024`.

### 3.3 Charts

Recharts stays. Line width 1.5px, area fill at 8% opacity of the series colour, horizontal
hairline grid only, axis ticks 10px muted mono, no axis lines, tooltip on `--c-raised` with a
`--c-line-strong` border and no blur. Series palette: accent text first (`#a78bfa` dark,
`#5b21b6` light), then a purple-and-grey ramp (`#8b5cf6`, the muted text token,
`#c4b5fd`/`#9d4edd`, `#6b6b78`/`#3f3f46`, `#ddd6fe`/`#a855f7` for dark/light) that keeps at
least 3:1 against the raised surface in each theme. Area fills are a flat 8% opacity, never a
gradient. `useChartTheme()` supplies `gridProps`, `axisProps`, `tooltipProps`, `lineProps`, and
`areaProps` (1.5px strokes, no dots, no entrance animation). Recharts needs concrete
colours for SVG attributes, so `ui/ChartFrame` reads the tokens with `getComputedStyle` once per
theme change and exposes them through `useChartColors()`. `chartTheme.jsx` is folded into it.

### 3.4 Terminal authenticity rules

These are the concrete rules that keep the product from reading as generated boilerplate.
They are checked in review and in the final verification pass.

1. One monospaced family for all text. No sans-serif, no display font, no font pairing.
2. Hard edges everywhere: buttons, inputs, chips, toasts, drawer, dialogs, badges. No radius.
3. No gradients, glows, blur, shadows, sheen, or animated backgrounds. A floating layer is a
   raised tone with a 1px border.
4. No emoji anywhere. Functional glyphs only, from Lucide at 12px with a 1.5 stroke: search,
   close, star, bell, chevrons, arrow-up-right for external links. No decorative icons on
   section titles, nav items, empty states, or stats.
5. Section titles are uppercase, accent-coloured, left-aligned, prefixed with the mnemonic
   where the section mirrors a function. No subtitles, no marketing lines under titles.
6. Lists are numbered "1)" in a muted first column like Bloomberg lists. In a focused
   navigable list the digit keys 1 to 9 open that row.
7. Enter is `<GO>`. The command line shows a `GO` label on the right and suggestions read
   "GO" rather than "Open".
8. Copy is terse terminal vocabulary in uppercase labels: LAST, CHG, OPEN, PREV, HI, LO, VOL,
   MKT CAP, P/E, EPS, 52W HI, 52W LO, YLD, BP. No exclamation marks, no filler such as
   "real-time global overview", no "powered by", no sparkle or rocket imagery.
9. Timestamps are 24-hour with seconds. Dates in tables are `04 SEP 26` style; ISO in inputs.
10. Loading is text ("LOADING…") or plain skeleton lines. No spinners.
11. Layout is a full-bleed hairline grid. No centred hero, no card deck, no rounded stat
    tiles, no symmetric three-column feature rows.
12. The bottom line is a terminal status line: quote count, freshness, session state.
13. Purple stands where Bloomberg puts amber. Amber is reserved for warnings and alerts.

## 4. Component kit (`src/ui/`)

Each component is a small file with a documented prop contract. Styling lives in `index.css`
under `.pb-*` classes; components carry no inline colours.

| Component | Contract |
|---|---|
| `Section` | `title`, `mnemonic?`, `meta` (node, right side), `actions` (node), `flush` (no inner padding, for tables), `children`. Renders a hairline-bordered region with the uppercase accent-coloured title header, mnemonic first when given. |
| `Stat` | `label`, `value`, `sub`, `tone` (`up`, `down`, `warn`, default). Label over mono value. `StatRow` lays Stats in a hairline grid. |
| `DataTable` | `columns: [{key, label, align, width, sortable, sortValue(row), render(row)}]`, `rows`, `rowKey(row, index)`, `sort {key, dir}`, `onSort`, `selectedKey`, `onRowClick`, `navigable` (roving tabindex, arrows, Enter, Space, digits 1 to 9 open the nth visible row), `numbered` (muted "1)" first column), `virtualize` (fixed `--row-h` windowing for > 60 rows), `loading` (skeleton rows), `empty` (node). Numeric columns right-aligned. Headers expose `aria-sort`. Rows are keyboard-navigable whenever `onRowClick` is set; with `virtualize`, numbering and digit keys are relative to the first visible row; the table carries `role="grid"` when navigable. |
| `Sparkline` | `values: number[]`, `width`, `height`; colour from sign of last minus first. Pure SVG polyline. |
| `ChartFrame` | Wraps a Recharts chart with the theme, fixed height, text loading state, empty state; `useChartTheme()` returns colours plus grid, axis, tooltip, line, and area props. |
| `Segmented` | `options: [{value, label}]`, `value`, `onChange`, `aria-label`. Used for chart type, range, list mode, tabs of secondary importance. |
| `Tabs` | `tabs`, `active`, `onChange`; `role="tablist"`, underline marker. |
| `Button` | `variant: primary | ghost | danger`, `size`, `loading` (disables the button and sets `aria-busy`); icons are passed as children. |
| `Input`, `Select`, `Kbd` | Square form controls at `--ctl-h`; `Input` supports `mono`; `Select` calls `onChange(value)`. |
| `ListDetail` | `list` (node), `detail` (node), `listWidth`, `mobile: { label, options: [{ value, label }], value, onChange }`. Desktop: list left with hairline, detail right. Mobile: a native select above the detail. |
| `Ticker` | `symbol`, `name?`, `starred?`. Mono bold symbol; click opens quick-look; Space toggles star when focused. |
| `Change` | `value`, `suffix ("%"\|"bp"\|"")`, `decimals`. Signed, coloured, mono. Replaces `ChgVal`. |
| `Price` | Mono value with the tick flash on change (kept from today). |
| `Freshness` | `updatedAt`, `intervalMs`. "updated 9s ago"; amber "stale 2m" when age > max(3 × interval, 45s); "offline" when the feed is down. One shared 1s ticker. |
| `Drawer` | Right sheet, `open`, `onClose`, `title`, `width`. `role="dialog"`, focus trap, Esc, click-outside. Full width on mobile. |
| `Toast` | Stack bottom-right, max 5, `tone`, optional actions (Undo, Dismiss, Re-arm). Sticky toasts (alerts) persist until dismissed and are never evicted by non-sticky ones; info toasts auto-dismiss in 4s. The `aria-live="polite"` region is always mounted. |
| `Dialog` | Confirmations (reset data, delete transactions). |
| `EmptyState` | Icon-free message plus optional action. |
| `Skeleton` | Row placeholders used by tables and charts while loading. |
| `Tag` | Square outline, uppercase, muted; used only for exchange, market state, IPO status, impact. Named `Tag` because the old screens keep a `pb-badge` class until P2. |

Deleted once the kit lands: `src/shared.jsx`, `src/chartTheme.jsx`, `src/components/*`,
`src/ThemeContext.jsx` (replaced by `stores/settings` plus a theme applier).

## 5. Shell (`src/shell/`)

- **TopBar (32px):** wordmark (purple square plus "PURPLEBERG"), breadcrumb "DES · Equities",
  CommandLine, alerts bell with active count (opens a popover listing armed and recently
  triggered alerts with re-arm and delete), session clock, wall clock. Nothing else.
- **Sidebar:** one entry per screen: label plus mnemonic. Active entry has a 2px inset accent
  bar and full-strength text. Collapsed (44px) shows mnemonics only. Collapse state persists in
  the `ui` store; tablet width forces collapsed. No footer.
- **BottomTape (22px):** scrolling tape of the top 20 tracked names, symbol, price, change
  only; right cluster shows "250 quotes · 9s ago" through `Freshness`. Hidden on mobile.
- **MobileTabs:** Dashboard, Equities, Portfolio, News, Menu (opens the full screen list).
- **CommandLine:** see section 7.2.
- **QuickLook:** see section 7.4.
- **Toasts, OfflineBanner, ShortcutSheet:** see sections 7.7, 7.8.

## 6. Routing

In-house History API router (`src/router/`): `matchRoute(path, routes)` is pure and tested;
`useRoute()` returns `{ name, params, query }`; `navigate(path, { replace })`; `Link`.
`popstate` re-matches. Unknown paths render the Dashboard and show an info toast
"Unknown function". Symbols are `encodeURIComponent`-ed in path segments; FX pairs use the
six-letter slug (`/fx/EURUSD` → `EURUSD=X`).

| Route | Mnemonic | Screen | Query |
|---|---|---|---|
| `/` | WEI | Dashboard | |
| `/equities/:symbol?` | DES | Equities | `tab`, `range`, `type`, `list=watch\|all` |
| `/screener` | EQS | Screener | `preset`, `screen`, `sort`, `dir` |
| `/compare` | COMP | Compare | `a`, `b`, `range` |
| `/fx/:pair?` | WFX | FX | `range` |
| `/rates` | YAS | Rates & Macro | `tab=curve\|calendar`, `impact` |
| `/commodities/:symbol?` | CMDT | Commodities | `tab`, `range`, `type` |
| `/crypto/:id?` | CRYP | Crypto | `tab`, `range`, `type` |
| `/ipos` | IPO | IPOs | |
| `/portfolio` | PORT | Portfolio | `tab=holdings\|transactions\|allocation\|risk` |
| `/news` | TOP | News | `q` |
| `/settings` | SET | Settings | `section` |

Aliases kept from the old navigation: `ECO` → `/rates?tab=calendar`, `MARS` → `/portfolio?tab=risk`.
The Vite dev server and the Express `app.get("*")` fallback already serve `index.html` for
deep links. Screen-local state that is not in the URL (scroll position, open drawer) resets on
navigation, which is acceptable.

## 7. Features

### 7.1 Persistent stores (`src/stores/`)

`createStore(key, initial, { migrate })` returns `{ get, set, update, subscribe }` and a
`useStore(store, selector)` hook built on `useSyncExternalStore`. Writes are debounced 150ms
into `localStorage` under `purpleberg.<key>`; the `storage` event syncs other tabs. Every read
and write is wrapped in try/catch so private mode or a full quota degrades to in-memory.

| Store | Shape | Notes |
|---|---|---|
| `settings` | `{ theme: 'dark'\|'light'\|'system', density: 'compact'\|'comfortable', refreshSec: 10\|15\|30\|60, defaultScreen: 'WEI', notifications: boolean }` | Migrates `purpleberg_theme`. |
| `watchlist` | `{ symbols: string[] }` | Seed: NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA, JPM. Max 50, uppercase, deduplicated. |
| `alerts` | `{ items: [{ id, symbol, op: 'above'\|'below', price, baseline, createdAt, triggeredAt: number\|null }] }` | See 7.5. |
| `portfolio` | `{ transactions: [{ id, date: 'YYYY-MM-DD', symbol, side: 'buy'\|'sell', shares, price, fees }] }` | Migrates `purpleberg_portfolio` holdings into one `buy` each dated on migration day with `note: 'imported'`. |
| `savedScreens` | `{ items: [{ id, name, filters }] }` | See 7.6. |
| `ui` | `{ sidebarCollapsed: boolean }` | |

Settings › Storage exports every store as one JSON file and imports it back (validated,
confirmed, then replaces). Reset clears all `purpleberg.*` keys after a confirmation dialog.

### 7.2 Command line and keyboard

Grammar (input trimmed and uppercased, split on whitespace):

1. If the first token is a mnemonic or alias: navigate; a second token is passed as the
   screen's symbol, pair, or id when that screen accepts one (`DES AAPL`, `WFX EURUSD`).
2. Else if the last token is a mnemonic (Bloomberg order, `AAPL DES`): same as 1.
3. Else the input is a symbol or search query: suggestions come from the watchlist, the
   tracked 250, then the Yahoo search endpoint (debounced 400ms, existing `useSearch`).
   Enter opens the first suggestion in Equities; Shift+Enter opens it in quick-look.
4. Commands: `THEME` (cycle theme), `DENSITY` (toggle), `HELP` (shortcut sheet).

Sections in the dropdown: Functions, Watchlist, Tracked, Search, Commands. Arrow keys move,
Enter selects, Esc closes. The dropdown is a `role="listbox"`. The input shows a `GO` label
on its right edge, the typed text renders in the accent colour, and each suggestion ends with
"GO" as its action hint.

Global keys (ignored while focus is in an input, textarea, or select):

| Key | Action |
|---|---|
| `/`, `Ctrl+K`, `Cmd+K` | Focus the command line |
| any letter or digit | Focus the command line with that character |
| `Esc` | Close the top-most layer (command line, popover, drawer, dialog, sheet) |
| `?` | Shortcut sheet |
| `↑` `↓` | Move within a navigable list; `Enter` opens; `Space` toggles watchlist star |
| `1` to `9` | While a navigable list has focus, open its nth visible row |

### 7.3 Watchlist

`Ticker` shows a star affordance on hover and focus; star toggles membership and shows an
info toast with Undo. Dashboard "Watchlist" section lists the symbols with a 5-day sparkline
(historical `range=5d`, `interval=1d`, client-cached 5 minutes), price, change, market cap.
Equities, Screener, and the command line offer a Watchlist / All 250 mode; Equities defaults
to Watchlist when it is non-empty. The News feed requests the first four watchlist symbols
(falls back to the current hardcoded six when the watchlist is empty). Settings › Watchlist
allows add, remove, and reorder (up and down buttons).

### 7.4 Quick-look drawer

`QuickLookContext` exposes `open(symbol)` and `close()`; the drawer is mounted once in the
shell. Content: symbol, name, exchange and state badges, star, bell, close; price and change;
1-month sparkline (historical `1mo`); stats grid: Open, Prev close, High, Low, Volume, Avg
volume, Market cap, P/E, EPS, 52-week range with a position bar, Dividend yield, Beta;
up to three headlines from the global news feed tagged with the symbol; buttons "Open in
Equities" (navigates, closes) and "Add to portfolio" (navigates to `/portfolio?tab=transactions`
with the symbol prefilled). Quotes come from the pool when present, otherwise a one-off
`useQuotes([symbol])`. Bell opens an inline alert form (above or below, price, Save).

### 7.5 Price alerts (`src/lib/alerts.js`)

`evaluate(alerts, quotesBySymbol, now)` returns the alerts that fire. An alert fires when its
condition holds for the current price and did not hold for `baseline` (the price at creation
or at the last re-arm). Firing sets `triggeredAt`; a fired alert stays listed until deleted or
re-armed (re-arm resets `baseline` to the current price and clears `triggeredAt`). If the
condition already holds at creation, the form shows "Already above 1,240.00; it will fire the
next time price crosses from below" and still allows saving. Alert symbols outside the tracked
250 are added to the quote pool. On fire: a persistent toast with Dismiss and Re-arm, and a
browser `Notification` when `settings.notifications` is on and permission is granted.
Permission is requested only from Settings › Alerts.

### 7.6 Screener presets and saved screens (`src/lib/screener.js`)

Derived columns per quote: `pos52 = (price − week52Low) / (week52High − week52Low)` (null when
the range is invalid), `offHigh = price / week52High − 1`.

| Preset | Predicate |
|---|---|
| Dividend payers | `dividendYield ≥ 2` |
| Value | `0 < pe ≤ 15` |
| High beta | `beta ≥ 1.5` |
| Near 52-week high | `price ≥ 0.95 × week52High` |
| Near 52-week low | `price ≤ 1.10 × week52Low` |
| Mega cap | `marketCap ≥ 500e9` |

Filters: search, exchange, P/E min and max, price min and max, market cap min (billions),
dividend yield min, beta min and max, 52-week position min and max (percent). A preset fills
the filters and can be edited further. "Save screen" stores the current filters under a name;
saved screens appear as chips next to presets with a delete affordance. `?preset=` and
`?screen=` restore state. Columns: Ticker, Name, Price, Chg %, Mkt cap, P/E, Volume, Beta,
Div %, 52W pos, Off high, Exch. Row click opens quick-look; first column shows the star.

### 7.7 Freshness and offline

Polling hooks return `{ data, loading, error, updatedAt }`. `Freshness` renders the age.
The quote pool tracks consecutive failures: two in a row set `feedStatus = 'offline'`; the next
success sets `'online'`. Offline shows a one-line amber banner under the top bar, "Data feed
unreachable since 14:02. Showing last known values." with a Retry button, plus a toast on the
transition each way. All screens keep rendering their last data.

### 7.8 Market session clock (`src/lib/session.js`)

`nyseSession(date)` returns `{ state: 'pre'|'open'|'post'|'closed', nextChangeAt, label }`
using `Intl.DateTimeFormat` with `timeZone: 'America/New_York'` (no manual DST tables).
Regular session 09:30–16:00 ET, pre-market 04:00–09:30, after-hours 16:00–20:00, otherwise
closed. Weekends closed. Full-day holidays 2026: Jan 1, Jan 19, Feb 16, Apr 3, May 25, Jun 19,
Jul 3, Sep 7, Nov 26, Dec 25. Early closes (13:00) 2026: Nov 27, Dec 24. Holidays 2027: Jan 1,
Jan 18, Feb 15, Mar 26, May 31, Jun 18, Jul 5, Sep 6, Nov 25, Dec 24. Early close 2027: Nov 26.
The lists live in one data file that is easy to extend. When the `^GSPC` quote carries a
`marketState`, it wins for the state label; the schedule always drives the countdown.
The top bar shows "● NYSE open · closes 2:41:07" (or "opens in 16:12:04"); hover or click
shows New York, London, and Tokyo local times.

### 7.9 Portfolio upgrades (`src/lib/portfolio.js`)

- **Transactions** are the source of truth. Holdings are derived per symbol in date order:
  buy adds shares and cost (`shares × price + fees`); sell realises `shares × (price − avgCost) − fees`,
  reduces cost by `shares × avgCost`, and reduces shares. A sell larger than the position is
  rejected at input. Average cost = cost / shares.
- **Live figures:** market value, unrealised P&L, day P&L (`shares × (price − prevClose)`),
  total return, realised P&L. Rows without a live quote show "—" and are excluded from the
  aggregates, with a stale count in the section meta (kept from today).
- **Performance series:** daily over the last year (or since the first transaction if later)
  on `^GSPC` trading days. Value(d) uses shares held at d and the close (last close carried
  forward on gaps). Daily return uses one-day Dietz with cash flows at the start of the day:
  `r = (V(d) − V(d−1) − CF(d)) / (V(d−1) + CF(d))` where `CF(d)` is buys minus sells at
  transaction prices on d. The chained index is plotted against `^GSPC` normalised to 100.
- **Risk tab** (needs ≥ 20 daily returns, otherwise an explanatory empty state):
  annualised volatility (`stdev × √252`), max drawdown of the chained index, beta to `^GSPC`,
  best and worst day, 1-day 95% historical VaR (`−quantile(r, 0.05)`), Sharpe
  (`(mean(r) × 252 − rf) / vol`, `rf` = current `^IRX` / 100).
- **Allocation tab:** by holding, and by sector using `profile.sector` from `/api/financials`
  fetched lazily per holding (30-minute server cache), "Unknown" bucket when missing.
- **CSV:** export `date,symbol,side,shares,price,fees`; import parses, validates, previews the
  rows, then appends. Sample portfolio: eight transactions across AAPL, MSFT, NVDA, JPM, XOM
  spread over the past year, offered from the empty state.

### 7.10 Settings

Sections: Appearance (theme, density), Data (refresh rate, default screen), Alerts (browser
notifications with a permission button and status), Watchlist (manage), Storage (export,
import, reset), About (version from `package.json`, "by Rubayet Rezwan", short data disclaimer,
data sources list moved from Economics, API key status from `/api/status`).

### 7.11 Backend

`GET /api/status` → `{ version, finnhub: boolean, coingecko: boolean }`, rate-limited like the
other routes, no caching. No other server change.

## 8. Screens

Every screen is a route component under `src/screens/`, built only from the kit, with no
inline colours. Data hooks are the existing ones unless stated.

| Screen | Layout and content |
|---|---|
| Dashboard | Index strip (10 indices, hairline grid, 5 columns). Then a 3-column grid: Watchlist (numbered rows, sparklines), Movers (numbered, top gainers and losers from the 250 with a small bar), News (numbered, 10). Second row: Breadth (advancers, decliners, percent positive, median move, from the 250), Rates mini (3M, 10Y, 30Y, 10Y−3M spread), Commodities mini. The 16-tile market map is removed. |
| Equities | `ListDetail`. List: Watchlist / All 250 segmented control, filter input, numbered rows with symbol, price, change, navigable. Detail: header (symbol, name, exchange and state badges, star, bell), `StatRow` (Last, Change, Mkt cap, P/E, Volume, 52W), `Tabs` Chart, Financials, Estimates, Ratios, Profile with today's data and the existing ratio units, `ChartFrame` with Segmented type (Area, Line, Volume) and range (1M, 3M, 6M, 1Y, 5Y). |
| Screener | Section with preset and saved-screen chips, filter bar, virtualised `DataTable`, result count and freshness in the meta. |
| Compare | Two ticker inputs plus Compare, Swap, Clear; side-by-side stats; normalised chart with range; fundamentals and ratios rows with winner highlighting; recent news per symbol. URL-driven. |
| FX | `ListDetail`. List: pairs with rate and change. Detail: header, chart with range segmented control (1M, 3M, 6M, 1Y), stats (rate, day range in pips, change, high, low), calculator. |
| Rates & Macro | Tabs Curve and Calendar. Curve: yield curve chart, treasury table, spread rows (10Y−3M, 30Y−10Y, curve shape). Calendar: events table with an impact filter (All, High), refresh, mobile card layout. |
| Commodities | `ListDetail` with Chart, Stats, Spec tabs as today. |
| Crypto | `ListDetail` with Chart, Stats, About tabs as today, keeping the id-plus-symbol selection logic. |
| IPOs | Two sections: curated table with live quotes, live Finnhub calendar or the "not configured" note; disclaimer footnote. |
| Portfolio | `StatRow` summary (Value, Day P&L, Total P&L, Return, vs S&P 500 over the same window). Tabs Holdings, Transactions, Allocation, Risk. Performance chart above the tabs when there are ≥ 2 data points. |
| News | Filter input; numbered list grouped Today and Earlier; each row: number, time, publisher, `Ticker` chip, title. |
| Settings | As in 7.10. |

Mobile rules: `ListDetail` becomes a selector plus detail; tables scroll horizontally inside
their section; the drawer and command line are full width; bottom tabs replace the sidebar.

## 9. Data layer (`src/data/`)

- `api.js` unchanged plus `status()`.
- `hooks.js` keeps the visibility-pausing polling pattern and adds `updatedAt` and `error` to
  every polling hook. A `usePollInterval(baseMs)` hook scales any interval by
  `settings.refreshSec / 15`.
- `QuotePool`: one `useQuotes` in the app root over the deduplicated union of the tracked 250,
  watchlist, alert symbols, and portfolio symbols (hard cap 300, matching the proxy). Exposed
  through `useQuote(symbol)` and `useQuotes(symbols)` selectors that read the pool. Screens with
  their own universes keep their own polls as today.
- `useSparklines(symbols)`: batched historical fetch with concurrency 4 and a 5-minute
  client cache.
- `feedStatus` store as in 7.7.
- Existing hooks `useHistorical`, `useFinancialsWithRetry`, `useNews`, `useCryptoMarkets`,
  `useCryptoChart`, `useIpoCalendar`, `useSearch` are kept.

## 10. Testing

Unit tests with `node:test` (run by `npm test`), one file per pure module:

- `router.test.js`: static, param, optional param, query parsing, unknown path, path building
  with encoded symbols.
- `session.test.js`: open, pre, post, closed, weekend, holiday, early close, countdown across
  the DST changes in March and November 2026.
- `alerts.test.js`: above and below crossing, no fire without a cross, no double fire, re-arm.
- `portfolio.test.js`: average cost with sells, realised and unrealised P&L, rejection of
  oversells, Dietz returns with a mid-window buy, metrics on a fixture with known answers,
  the 20-return minimum.
- `screener.test.js`: derived columns, each preset, combined filters, sort stability.
- `stores.test.js`: migration of the old portfolio and theme keys, export and import
  round-trip, corrupt JSON tolerance (with a `localStorage` shim).
- `format.test.js`: the formatters moved from `config.js`.
- Existing `compareUtils`, `ipoUtils`, and `server/format` tests stay green.

Browser verification (both backend and frontend running through the Browser pane), recorded
per screen before the branch is finished: dark and light; 375, 768, 1440; console errors and
failed requests empty; command line and mnemonic jump; list arrows and Enter; Esc closes each
layer; reload and back and forward keep state; alert at the current price fires a toast;
sample portfolio yields metrics; stopping the backend shows the banner and restarting clears
it; reduced motion; keyboard-only pass on Equities and Screener.

Bundle size: `vite build` output compared against the baseline commit.

## 11. Rollout

- `npm install`; `git init` with a baseline commit of the received code (done on 2026-09-04);
  work on `redesign/terminal-v3`, one commit per task; `.superpowers/` ignored.
- **P0 Foundation:** tokens and CSS, kit, router, stores, data layer, shell. The old screens
  stay mounted behind the new router until each is replaced, so the app runs at every commit.
- **P1 Screens**, one at a time, deleting the old file as each lands: Dashboard, Equities,
  Screener, Compare, FX, Rates & Macro, Commodities, Crypto, IPOs, News, Settings, Portfolio.
- **P2 Features** threaded through: watchlist, quick-look, alerts, session clock, keyboard,
  freshness and offline, portfolio math.
- **P3:** verification pass including the section 3.4 checklist, README rewrite
  (architecture, screens, features, shortcuts), code-reviewer agent pass, then the branch is
  offered for merge.
- Pure modules are written test-first. Independent tasks may run in subagents.

## 12. Out of scope

Authentication, licensed market data, compare with more than two symbols, sector heatmap,
server changes beyond `/api/status`, service worker or offline caching, internationalisation,
drag-and-drop reordering, mobile gestures beyond native scrolling.
