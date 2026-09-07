# Purpleberg Terminal

A Bloomberg-style market terminal built as a personal project: React 18 + Vite
frontend, and a thin Express proxy to Yahoo Finance, CoinGecko, Forex Factory,
and an optional Finnhub IPO calendar. Twelve function screens, reached by
mnemonic from a command line, cover equities, a screener, side-by-side compare,
FX, the treasury curve and macro calendar, commodities, crypto, IPOs, news, a
transaction-based portfolio with returns and risk, and settings. The market
screens track the top 250 US equities by market cap through one shared quote
poll.

> **This is a hobby / learning project, not a licensed market-data product.**
> Read the [Data source disclaimer](#data-source-disclaimer) before running it
> in front of anyone.

The interface is deliberately plain: one monospaced family, a black canvas,
hairline rules instead of cards, and a single accent colour used where a
Bloomberg screen uses amber. Density over decoration, because the job is to
read a lot of numbers at once.

---

## Quick start

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

`cp .env.example .env` first if you want the optional keys below. Run the halves
separately with `npm run dev:server` and `npm run dev:client`. Node 18+ is
required (ESM + `fetch`).

---

## Using the terminal

Every screen has a mnemonic, and the command line is the fastest way to any of
them. Type into the box at the top, or press `/` from anywhere.

| Mnemonic | Screen | What it holds |
| --- | --- | --- |
| `WEI` | Dashboard | World indices, watchlist with sparklines, movers, breadth, rates and commodities strips, headlines |
| `DES` | Equities | Symbol list with a detail pane: quote, ranges, period returns, chart, ratios, profile |
| `EQS` | Screener | Filters over the tracked 250, presets, saved screens, sortable virtualised table |
| `COMP` | Compare | Two symbols side by side: quote, ratios, normalised chart, headlines |
| `WFX` | FX | Major pairs and BDT crosses, day ranges in pips, one chart |
| `YAS` | Rates & Macro | Treasury curve, spreads and curve shape, and the economic calendar |
| `CMDT` | Commodities | Futures by group, 52-week range, period returns |
| `CRYP` | Crypto | Top 20 by market cap, dominance, ATL-to-ATH position, chart |
| `IPO` | IPOs | Curated 2026 IPOs with live quotes for the listed names, plus the Finnhub calendar |
| `PORT` | Portfolio | Transactions, holdings with live P&L, performance against the S&P 500, allocation, risk |
| `TOP` | News | Headlines for your watchlist, grouped into today and earlier, filterable |
| `SET` | Settings | Theme, density, refresh rate, default screen, alerts, watchlist, export/import, about |

**Command line grammar.** A mnemonic on its own goes to that screen (`EQS`). A
symbol on its own opens it in Equities (`NVDA`). Either order works for a
symbol plus a screen (`NVDA DES` and `DES NVDA` both open NVDA's detail).
`THEME LIGHT`, `DENSITY COMFORTABLE`, and `HELP` are also commands. Enter runs
the highlighted suggestion — the button reads `<GO>`, as it does on the real
thing.

**Keyboard.** `/` or `Ctrl`/`Cmd`+`K` focuses the command line; any letter or
digit starts typing into it. Inside a list: arrows move, `Home`/`End` jump,
`PageUp`/`PageDown` page, `1`–`9` jump to a visible row, `Enter` opens the
quick-look drawer, `Space` toggles the watchlist star. `Esc` closes the
topmost layer — drawer, dialog, sheet, or the command line. `?` shows the full
shortcut sheet.

**Watchlist, alerts, quick-look.** Every symbol on screen is clickable: it
opens a drawer with the quote, a sparkline, its headlines, and an alert form.
The star toggles the watchlist, which drives the dashboard, the news feed, and
the quote pool. Price alerts fire on a crossing (not on a level being true when
you set it) and appear in the bell in the top bar, with an optional browser
notification.

**Session clock.** The top bar shows whether the NYSE is open and counts down
to the next open or close, from a holiday and early-close schedule in
`src/lib/marketHolidays.js`. That table runs through 2027; the clock says so
rather than silently guessing once it runs out.

**Everything is a URL.** Screens, symbols, tabs, filters, and presets all live
in the path or the query string, so any view can be bookmarked or shared:
`/equities/AAPL?tab=ratios`, `/screener?preset=value&sort=pe`,
`/compare?a=AAPL&b=MSFT`, `/rates?tab=calendar`, `/crypto/bitcoin`,
`/news?q=apple`, `/portfolio?tab=risk`.

---

## Your data stays in your browser

The watchlist, alerts, saved screens, portfolio transactions, and settings live
in `localStorage` under `purpleberg.*` keys. There is no account, no server-side
storage, and nothing is sent anywhere except the market-data requests the
proxy makes on your behalf. Settings → Storage exports the whole lot as JSON,
imports it back, or resets it. The portfolio also exports as
`date,symbol,side,shares,price,fees` CSV.

---

## Architecture

```
┌──────────────────────┐      ┌─────────────────────────┐      ┌──────────────────┐
│ Vite dev / build     │─────▶│ Express proxy (3001)    │─────▶│ Yahoo Finance    │
│ React 18 + Recharts  │      │ LRU cache, rate limit   │      │ (unofficial)     │
│ Lucide icons         │      │ crumb/cookie auth       │      ├──────────────────┤
└──────────────────────┘      │                         │─────▶│ CoinGecko        │
                              │                         │      │ → CoinPaprika    │
                              │                         │      ├──────────────────┤
                              │                         │─────▶│ Forex Factory    │
                              │                         │      │ (macro calendar) │
                              │                         │      ├──────────────────┤
                              │                         │─────▶│ open.er-api.com  │
                              │                         │      │ (FX fallback)    │
                              │                         │      ├──────────────────┤
                              │                         │─────▶│ Finnhub          │
                              └─────────────────────────┘      │ (IPO cal., opt.) │
                                                               └──────────────────┘
```

```
src/
├── theme/index.css      # Every token and class. One monospaced family, one accent.
├── lib/                 # Pure logic, no React, unit-tested with node:test
│   ├── format.js        #   number, percent, clock, and date formatting
│   ├── portfolio.js     #   average-cost accounting, Dietz returns, risk metrics, CSV
│   ├── session.js       #   NYSE session state and countdown
│   ├── marketHolidays.js#   holiday and early-close table
│   ├── screener.js      #   filter predicates
│   ├── breadth.js       #   advancers/decliners/unchanged
│   ├── returns.js       #   period returns over a close series
│   ├── alerts.js        #   crossing semantics
│   └── ticker.js, id.js
├── ui/                  # The component kit: Section, Grid, DataTable, Stat, KV,
│                        # Change, Price, Ticker, Tag, Button, Input, Select,
│                        # Segmented, Tabs, Drawer, Dialog, Toasts, ChartFrame,
│                        # Sparkline, RangeBar, PeriodReturns, Freshness, …
├── router/              # In-house router: path matching, query, Link, navigate
├── stores/              # useSyncExternalStore stores persisted to localStorage
│                        # (settings, ui, watchlist, alerts, savedScreens, portfolio)
├── data/                # api.js, polling hooks, and the shared quote pool
├── shell/               # Top bar, command line, sidebar, tape, mobile tabs,
│                        # session clock, alerts bell, keyboard layer
├── features/            # News feed, quick-look drawer, alert engine, transaction form
└── screens/             # The twelve screens, built only from the kit
```

- **One quote poll.** `src/data/quotePool.jsx` polls a single batch — the
  tracked 250 plus your watchlist, alerted symbols, holdings, and anything
  currently open — with your symbols ordered first so the 300-symbol request cap
  can never starve them. Screens with their own symbol sets (FX, rates,
  commodities) poll separately at their own intervals.
- **Polling pauses** while the tab is hidden, and every screen shows how old
  its data is. When two polls in a row fail, an offline banner appears and the
  last values are kept rather than blanked.
- **No new runtime dependencies** were added for the redesign: the router,
  stores, drawer, toasts, dialogs, and table virtualisation are all in-house.
  Recharts and Lucide are the only UI libraries.
- **Pure logic is tested, components are not.** Anything under `src/lib/` is
  free of React and DOM and is covered by `node:test`; `.jsx` files are never
  imported by a test. `npm test` runs 151 tests.

---

## Environment variables

Create `.env` at the repo root. All are optional — defaults cover local dev.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Backend HTTP port. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | CORS allowlist, comma-separated. |
| `COINGECKO_API_KEY` | _unset_ | Optional CoinGecko Demo key; lifts the public rate limit. |
| `FINNHUB_API_KEY` | _unset_ | Optional [Finnhub](https://finnhub.io) key; enables the live IPO calendar. The curated 2026 list works without it. |

`GET /api/status` reports which of these are configured, as booleans — never the
keys themselves. Settings → About shows it.

---

## Honesty rules the UI follows

The point of a terminal is that you can trust what is on it. These are
deliberate, and visible in the interface:

- **A missing quote is an em dash, never a zero.** A holding without a live
  price is excluded from the aggregates and counted as stale in the section
  header, rather than being valued at cost and reported as flat P&L.
- **Every panel says how old it is** — "4s ago", "2m ago", or "STALE" — and
  distinguishes "loading" from "no data".
- **Derived numbers are labelled.** The BDT crosses on the FX screen are
  computed from two legs and tagged `DERIVED`, because their day range
  multiplies two extremes and is not a real traded range.
- **Portfolio returns are two different numbers, on purpose.** "Return on cost"
  compares market value with what you paid. The performance line is a daily
  Dietz chain, so a deposit is not a gain, and shares bought on a session are
  valued at their cost that day — otherwise the gap between your entry price
  and that day's close would show up as a one-day return.
- **Risk metrics hold back below 20 sessions** rather than reporting the
  standard deviation of a handful of days, and the screen says which 20 it
  wants.
- **Curated data says it is curated.** The 2026 IPO list is hand-collected from
  public reporting with a provenance footnote; the sample portfolio prices each
  buy at the actual close on its date, and is labelled sample.
- **Yields change in basis points**, not in percentage points, because that is
  how a rates desk reads them.

---

## Security notes

The proxy is hardened for **local, single-user** use and is not ready for the
public internet.

In place: CORS allowlist (not `*`); `express-rate-limit` at 600 req/min on
`/api/*`; a 32 KB JSON body limit; strict ticker validation on every
user-supplied symbol; `range`/`interval` allowlists on `/api/historical`; a
bounded LRU cache (max 2000, 15-minute default TTL).

Still required before exposing it: authentication and authorisation (there is no
user concept), a licensed market-data source, and TLS with a proper reverse
proxy.

---

## Data source disclaimer

Purpleberg Terminal is an educational project built on the **unofficial** Yahoo
Finance web endpoints (crumb/cookie auth). Those are not a licensed
market-data API. So:

- Do not redistribute this as a product.
- Do not trade on it without a licensed, authoritative feed.
- Expect breakage whenever Yahoo changes the flow.

The economic calendar is scraped from Forex Factory, and the IPO list is
hand-collected from public reporting — neither is a vendor feed. Commercial
replacements: IEX Cloud, Polygon, Alpaca, Refinitiv, Nasdaq Data Link,
Bloomberg B-PIPE.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Backend + frontend together. |
| `npm run dev:server` | Only the Express proxy. |
| `npm run dev:client` | Only Vite. |
| `npm run build` | Production build of the frontend. |
| `npm start` | Run the Express server alone; it serves `dist/` when present. |
| `npm test` | Unit tests (`node:test`). |

## Deployment

`render.yaml` describes a single Render web service: `npm install --include=dev
&& npm run build`, then `npm start`. The Express server serves the built frontend from
`dist/` and the API from the same origin, so no CORS configuration is needed.
Render's assigned URL is folded into the allowlist automatically via
`RENDER_EXTERNAL_URL`. Set `COINGECKO_API_KEY` and `FINNHUB_API_KEY` in the
dashboard if you have them.
