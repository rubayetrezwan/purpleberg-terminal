# Purpleberg Terminal

A Bloomberg-style market terminal built as a personal project: React + Vite
frontend, a thin Express proxy to Yahoo Finance and CoinGecko, and optional
Claude-powered chat. Twelve screens cover equities, FX, fixed income,
commodities, crypto (top 20 by market cap), a screener, portfolio tracking,
risk analytics, economic calendar, news, and a side-by-side stock compare
view.

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
                             │                         │──────▶ Anthropic API  │
                             └─────────────────────────┘      │  (chat only)   │
                                                              └────────────────┘
```

- `src/` — React app. Screens are lazy-free, live under `src/screens/`.
- `src/hooks.js` — data-fetching and polling hooks. Polls automatically pause
  while the tab is hidden.
- `src/ThemeContext.jsx` — single source of truth for dark/light palette;
  screens read colours via `useColors()`.
- `src/ErrorBoundary.jsx` — class-based boundary wrapped around the screen
  router so one broken panel cannot take down the terminal.
- `server/index.js` — Express proxy. Handles the Yahoo crumb dance, caches
  responses in a bounded LRU, rate-limits clients, and optionally forwards
  `/api/chat` to Anthropic.

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

Create `.env` at the repo root:

| Variable            | Default                                             | Meaning                                                |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `PORT`              | `3001`                                              | Backend HTTP port.                                     |
| `ALLOWED_ORIGINS`   | `http://localhost:5173,http://localhost:3001`       | CORS allowlist (comma-separated).                      |
| `ANTHROPIC_API_KEY` | _unset_                                             | Optional. Enables the AI Assistant (ASKB) screen.      |
| `CHAT_DAILY_MAX`    | `500`                                               | Max `/api/chat` requests per UTC day (spend guard).    |

If `ANTHROPIC_API_KEY` is missing, the AI screen degrades gracefully and
returns a friendly error instead of 500.

---

## Security notes

The proxy is hardened for **local / single-user** use. It is not ready to be
exposed on the public internet. What is already in place:

- CORS **allowlist** (not `*`). Non-matching origins are rejected.
- `express-rate-limit`: 120 req/min on `/api/*`, 10 req/min on `/api/chat`.
- JSON body limit of 32 KB.
- Strict ticker regex validation on every user-supplied symbol.
- Allow-lists for `range` / `interval` on `/api/historical`.
- Bounded LRU cache (`max: 2000`, 15-min default TTL) — no unbounded Map.
- Daily budget cap on `/api/chat` so a leaked deployment cannot burn an
  Anthropic key unchecked.
- `/api/chat` validates the `messages` array length (≤20) and truncates each
  message body to 4 000 chars.

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
| `npm run build`      | Production build of the frontend.    |
| `npm start`          | Run the Express server only (prod).  |

---

## Repo layout

```
purpleberg-terminal/
├── server/
│   └── index.js              # Express proxy (Yahoo + Anthropic)
├── src/
│   ├── App.jsx               # Screen router, top bar, command palette
│   ├── ErrorBoundary.jsx     # Per-screen error isolation
│   ├── ThemeContext.jsx      # Single source of truth for colours
│   ├── hooks.js              # useQuotes/useNews/useHistorical/useIsMobile
│   ├── api.js                # Thin fetch wrapper around the proxy
│   ├── config.js             # Tickers and formatting helpers
│   ├── shared.jsx            # Panel, Badge, MiniTable, DataCell, …
│   └── screens/              # Twelve function screens (incl. CompareStocks)
├── index.html
├── package.json
└── vite.config.js
```
