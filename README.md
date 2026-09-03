# Purpleberg Terminal

A Bloomberg-style market terminal built as a personal project: React + Vite
frontend and a thin Express proxy to Yahoo Finance and CoinGecko. Thirteen
screens cover equities, FX, fixed income, commodities, crypto (top 20 by market
cap), a screener, portfolio tracking, risk analytics, economic calendar, news, a
side-by-side stock compare view, and an IPO center (curated top-25 IPOs of 2026
with live quotes, plus a live IPO calendar). The market screens track the top
250 US equities by market cap.

> **This is a hobby / learning project, not a licensed market-data product.**
> Read the [Data source disclaimer](#data-source-disclaimer) before running it
> in front of anyone.

---

## Quick start

```bash
# 1. install
npm install

# 2. optional: configure env
cp .env.example .env   # then edit — see Environment variables below

# 3. run backend + frontend together
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

Run the halves separately with `npm run dev:server` and `npm run dev:client`.

Node 18+ is required (ESM + `fetch`).

---

## Architecture

```
┌─────────────────────┐      ┌─────────────────────────┐      ┌────────────────┐
│  Vite dev / build   │──────▶  Express proxy (3001)   │──────▶ Yahoo Finance  │
│  React 18 + Recharts│      │  LRU cache, rate-limit  │      │  (unofficial)  │
│  Lucide icons       │      │  crumb/cookie auth      │      └────────────────┘
└─────────────────────┘      │                         │──────▶ CoinGecko API  │
                             │                         │      │  (public, no key)│
                             │                         │      └────────────────┘
                             │                         │──────▶ CoinPaprika    │
                             └─────────────────────────┘      │  (crypto fallback)│
                                                              └────────────────┘
```

- `src/` — React app. Screens live under `src/screens/`.
- `src/hooks.js` — data-fetching and polling hooks. Polls automatically pause
  while the tab is hidden.
- `src/ThemeContext.jsx` — single source of truth for dark/light palette;
  screens read colours via `useColors()`.
- `src/ErrorBoundary.jsx` — class-based boundary wrapped around the screen
  router so one broken panel cannot take down the terminal.
- `server/index.js` — Express proxy. Handles the Yahoo crumb dance, caches
  responses in a bounded LRU, rate-limits clients, and proxies CoinGecko with an
  automatic CoinPaprika fallback when CoinGecko rate-limits the deploy IP. Also
  serves the Finnhub IPO calendar (`/api/ipo-calendar`, optional key) and a
  keyless `open.er-api.com` FX fallback that fills in `=X` pairs (incl. the BDT
  crosses) when Yahoo returns nothing, so the FX screen never goes blank.

### Data flow

1. A screen calls `useQuotes([...])` / `useHistorical(sym)` / `useFinancials(sym)`.
2. The hook hits the Express proxy on `localhost:3001`.
3. The proxy checks its LRU cache. On miss it fetches from Yahoo Finance using
   a cached crumb/cookie pair, normalises the response, and stores it with a
   TTL appropriate for the endpoint.
4. On error, stale cache entries are returned when available so the UI stays
   populated.

---

## Environment variables

Create `.env` at the repo root (all are optional — defaults cover local dev):

| Variable             | Default                                       | Meaning                                                     |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `PORT`               | `3001`                                        | Backend HTTP port.                                         |
| `ALLOWED_ORIGINS`    | `http://localhost:5173,http://localhost:3001` | CORS allowlist (comma-separated).                          |
| `COINGECKO_API_KEY`  | _unset_                                       | Optional CoinGecko Demo key; lifts the public rate limit.  |
| `FINNHUB_API_KEY`    | _unset_                                       | Optional [Finnhub](https://finnhub.io) key; enables the **live IPO calendar**. The curated 2026 IPO list works without it. |

---

## Security notes

The proxy is hardened for **local / single-user** use. It is not ready to be
exposed on the public internet. What is already in place:

- CORS **allowlist** (not `*`) via `ALLOWED_ORIGINS`. Browser requests from a
  non-matching origin are rejected; requests with no `Origin` header (curl,
  same-origin server-to-server such as the Vite dev proxy) are allowed.
- `express-rate-limit`: 600 req/min on `/api/*`.
- JSON body limit of 32 KB.
- Strict ticker regex validation on every user-supplied symbol.
- Allow-lists for `range` / `interval` on `/api/historical`.
- Bounded LRU cache (`max: 2000`, 15-min default TTL) — no unbounded Map.

What is still required before exposing this publicly:

- AuthN / authZ (there is currently no user concept).
- A licensed market-data source — Yahoo Finance is **not licensed** for
  redistribution and the crumb/cookie flow is an unofficial scrape.
- TLS termination, HSTS, and a proper reverse proxy.

---

## Known caveats in the quant code

These are intentional, documented, and labelled in the UI:

- **Risk Analytics** shows _cross-sectional dispersion_ across today's
  watchlist returns. It is **not** a time-series Value-at-Risk on a real
  portfolio. Metrics are labelled "5th %ile Return", "1st %ile Return", and
  "Tail Mean (≤5%)" rather than VaR/CVaR to avoid implying otherwise. The
  "ILLUSTRATIVE SCENARIOS" panel scales today's dispersion by historical
  drawdowns — **not a real stress test**.

- **FX Dashboard** shows "Day Range" in pips rather than a bid/ask spread.
  Yahoo's `v7/quote` does not expose real bid/ask for FX spot pairs, so any
  "spread" number would be fabricated.

- **Portfolio Manager** renders `—` instead of silently falling back to cost
  basis when a live quote is missing. The P&L header aggregates only over
  positions that currently have a live quote, and a "stale" counter is shown
  in the panel subtitle.

---

## Data source disclaimer

Purpleberg Terminal is an educational project built around the **unofficial**
Yahoo Finance web endpoints (crumb/cookie auth). Those endpoints are not a
licensed market-data API. You should:

- Not redistribute this as a product.
- Not use it to make trading decisions without a licensed, authoritative feed.
- Expect breakage any time Yahoo changes the flow.

Commercial-grade replacements: IEX Cloud, Polygon, Alpaca, Refinitiv, Bloomberg
B-PIPE, Nasdaq Data Link.

---

## Scripts

| Command              | Purpose                               |
| -------------------- | ------------------------------------- |
| `npm run dev`        | Run backend + frontend concurrently.  |
| `npm run dev:server` | Run only the Express proxy.           |
| `npm run dev:client` | Run only Vite (frontend).             |
| `npm run build`      | Production build of the frontend.     |
| `npm start`          | Run the Express server only (prod).   |
| `npm test`           | Run the unit tests (node:test).       |

---

## Repo layout

```
purpleberg-terminal/
├── server/
│   └── index.js              # Express proxy (Yahoo + CoinGecko/CoinPaprika)
├── src/
│   ├── App.jsx               # Screen router, top bar, command palette
│   ├── ErrorBoundary.jsx     # Per-screen error isolation
│   ├── ThemeContext.jsx      # Single source of truth for colours
│   ├── hooks.js              # useQuotes/useNews/useHistorical/useIsMobile
│   ├── api.js                # Thin fetch wrapper around the proxy
│   ├── config.js             # Tickers and formatting helpers
│   ├── compareUtils.js       # Pure helpers for the Compare screen (unit-tested)
│   ├── shared.jsx            # Panel, Badge, MiniTable, DataCell, …
│   └── screens/              # Twelve function screens (incl. CompareStocks)
├── index.html
├── package.json
└── vite.config.js
```
