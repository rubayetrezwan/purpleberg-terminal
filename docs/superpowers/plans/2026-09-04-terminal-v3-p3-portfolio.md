# Plan P3: Portfolio, legacy removal, and release

Design: `docs/superpowers/specs/2026-09-04-terminal-v3-redesign-design.md` (section 7.9 and
the Portfolio row of section 8). Follows Plan P2, which rebuilt eleven of the twelve screens.

**Why Portfolio moved ahead of P2 Tasks 11 and 12:** `src/screens/PortfolioManager.jsx` is the
only file still importing `src/shared.jsx`, `src/chartTheme.jsx`, `src/ThemeContext.jsx`, and
the `src/hooks.js` shim. The legacy layer cannot go and the verification pass cannot cover a
kit-built Portfolio until this screen is rebuilt, so P2 Tasks 11 and 12 run as Tasks 3 and 4
below.

Same rules as P1 and P2: pure logic in `src/lib/**.js` under `node:test`, React in `.jsx` that
no test imports, one commit per task, no new runtime dependencies, and the repo is
authoritative over any code block quoted here.

---

## Task 1: Portfolio logic (`src/lib/portfolio.js`)

**Files:** create `src/lib/portfolio.js` and `src/lib/portfolio.test.js`.

Average-cost accounting, transactions as the source of truth. Every function is pure and takes
its clock or price data as an argument.

| Export | Contract |
|---|---|
| `positionsFrom(transactions)` | Sorts by date then insertion order. Buy: `shares += s`, `cost += s * p + fees`. Sell: realises `s * (p - avgCost) - fees`, `cost -= s * avgCost`, `shares -= s`. Returns `{ positions, rejected }` where a sell larger than the position is rejected rather than clamped, and a symbol whose shares reach ~0 keeps its realised P&L with `shares: 0`. |
| `enrichPositions(positions, bySymbol)` | Adds `price`, `prevClose`, `value`, `unrealised`, `unrealisedPct`, `dayPnl`, `live`. No live quote leaves the numbers null and `live: false`. |
| `portfolioTotals(rows)` | Aggregates over `live` rows only: `value`, `cost`, `unrealised`, `dayPnl`, `realised` (all rows), `returnPct`, `staleCount`. |
| `allocation(rows, totals)` | `[{ key, value, pct }]` sorted desc, live rows only. Used for both the holding and the sector split (caller supplies the key). |
| `valueSeries(transactions, closesBySymbol, dates)` | Portfolio value per date using shares held on that date and the last close carried forward. |
| `flowsByDate(transactions)` | `{ [date]: buys - sells }` at transaction prices, fees included in buys. |
| `dietzSeries(values, flows, dates)` | Daily `r = (V(d) - V(d-1) - CF(d)) / (V(d-1) + CF(d))`, guarded against a zero or negative denominator, chained into an index starting at 100. Returns `{ returns, index }`. |
| `normalizeTo100(closes)` | Benchmark index on the same dates. |
| `riskMetrics(returns, index, { rf })` | `vol` (`stdev * sqrt(252)`), `maxDrawdown` (of the index), `best`, `worst`, `var95` (`-quantile(0.05)`), `sharpe` (`(mean * 252 - rf) / vol`). Null when fewer than 20 returns. |
| `beta(portfolioReturns, benchmarkReturns)` | Covariance over benchmark variance on the overlapping pairs; null under 20 pairs or on zero variance. |
| `toCsv(transactions)` / `parseCsv(text)` | `date,symbol,side,shares,price,fees`. The parser returns `{ rows, errors }` with a 1-based line number per bad row and never throws. |
| `SAMPLE_TRANSACTIONS(today)` | Eight buys across AAPL, MSFT, NVDA, JPM, XOM spread over the past year, dated relative to `today`, for the empty state. |

- [ ] **Step 1:** tests first, covering average cost across two buys, a partial sell realising
  P&L, an oversized sell landing in `rejected`, a full exit keeping realised P&L, stale rows
  excluded from the totals but counted, a value series with a price gap, a Dietz day with a
  cash flow, a flat series giving zero volatility, `riskMetrics` returning null under 20
  points, beta of a series against itself being 1, and a CSV round trip with one bad line.
- [ ] **Step 2:** implement, `npm test`, commit `lib: portfolio accounting, dietz returns, and risk metrics`.

---

## Task 2: Portfolio screen (PORT)

**Files:** create `src/screens/Portfolio.jsx` and `src/features/TransactionForm.jsx`; modify
`src/App.jsx`, `src/data/hooks.js`, `src/stores/portfolio.js`, `src/theme/index.css`; delete
`src/screens/PortfolioManager.jsx`.

- **Cutover:** on first mount, if the store has no transactions, call `migratePortfolio(localStorage)`
  and, when it returns rows, `replaceTransactions` them and toast how many holdings were
  imported. Then remove `usePortfolio` and `PORTFOLIO_KEY` from `src/data/hooks.js`; leave the
  old `purpleberg_portfolio` key in place so a downgrade still finds it.
- **Header:** `StatRow` with Value, Day P&L, Total P&L, Return, and vs S&P 500 over the same
  window. Freshness in the section meta, stale count when any row lacks a quote.
- **Performance chart** above the tabs whenever the series has at least two points: the chained
  index against `^GSPC` normalised to 100, `ChartFrame` + `LineChart`, no gradient fills.
- **Tabs** (`?tab=`): Holdings (symbol, shares, avg cost, last, day P&L, market value,
  unrealised, weight), Transactions (date, symbol, side, shares, price, fees, delete, plus the
  add form and CSV export and import), Allocation (by holding and by sector from
  `/api/financials`, lazily per symbol), Risk (the metric list or the "needs 20 sessions"
  empty state).
- **Empty state:** offers the sample portfolio and explains that everything stays in this
  browser.

- [ ] **Step 1:** build the screen and the form, wire the route, run the cutover.
- [ ] **Step 2:** verify in the browser: sample load, add and delete a transaction, an oversized
  sell refused, CSV round trip, all four tabs, 375px.
- [ ] **Step 3:** `npm test`, `npx vite build`, commit `screens: portfolio on transactions with returns and risk`.

---

## Task 3: Delete the legacy layer (was P2 Task 11)

**Files:** delete `src/shared.jsx`, `src/chartTheme.jsx`, `src/hooks.js`, `src/api.js`,
`src/ThemeContext.jsx`; modify `src/config.js`, `src/main.jsx`, `src/theme/index.css`.

- [ ] **Step 1:** `grep -rn "shared\|chartTheme\|ThemeContext\|from \"../hooks\"\|from \"../api\"" src`
  returns only the `src/data/**` self-references.
- [ ] **Step 2:** drop the formatter re-exports from `src/config.js`, keeping the ticker lists,
  `SECTORS`, and `IPO_2026`.
- [ ] **Step 3:** drop `ThemeProvider` from `src/main.jsx`.
- [ ] **Step 4:** delete everything between the `LEGACY:BEGIN` and `LEGACY:END` sentinels in
  `src/theme/index.css`, and the sentence about them in the file header.
- [x] **Step 5:** `npm test` (151 passing), `npx vite build` clean, and both sides re-measured
  with one script (gzip -9 over every emitted file, and over the transitive chunk graph of the
  entry plus the default screen).

| Measure | Baseline `73cb96e` | Terminal v3.0 | Delta |
|---|---|---|---|
| Total gzip, all of `dist` | 226.7 kB | 242.2 kB | +15.5 kB (+6.8%) |
| First load (entry + CSS + default screen) | 67.2 kB | 87.7 kB | +20.5 kB (+30%) |
| CSS | 3.5 kB | 6.4 kB | +2.9 kB |

**Guardrail 4 does not hold, and is not going to.** The chunking is correct — no screen and no
part of recharts leaks into the eager chunk, checked by grepping the entry chunk for
screen-only strings — so the growth is the interaction layer itself: the router, seven
persisted stores, the command line with its mnemonic grammar and suggestions, the keyboard
layer, the drawer, toast, and dialog layers, the alerts engine, and the shared quote pool, all
of which load on first paint because a terminal cannot wait for a chunk fetch on the first
keystroke. Deferring them would trade a measurable regression in responsiveness for about
20 kB. The design system also moved styling out of JS style objects into 6.4 kB of tokenised
CSS, which is a real (if small) part of the delta. Recorded rather than papered over; the
tradeoff is the user's to reverse.

- [x] **Step 6:** commit `chore: delete the pre-redesign UI layer`.

---

## Task 4: Verification pass (was P2 Task 12)

- [ ] Every route in both themes and both densities at 375, 768, and 1440, console and failed
  requests clean.
- [ ] Keyboard-only pass on Equities and Screener: `/` to the command line, arrows and Enter in
  the list, digits 1 to 9, Space to star, Esc through every layer, `?` for the sheet.
- [ ] Deep links: `/equities/AAPL?tab=ratios`, `/screener?preset=value&sort=pe`,
  `/compare?a=AAPL&b=MSFT`, `/rates?tab=calendar`, `/crypto/bitcoin`, `/news?q=apple`,
  `/portfolio?tab=risk`, each reloaded and stepped back through.
- [ ] Reduced motion on; the price flash still clears.
- [ ] Screenshots of every screen in dark, plus Dashboard, Equities, and Portfolio in light and
  at 375px.
- [ ] Record the results here as a table, mirroring P1, and commit.

---

## Task 5: Release

- [ ] README rewritten for the redesign: the twelve screens and their mnemonics, the command
  line, keyboard map, storage and privacy, data sources and their honesty caveats, the optional
  Finnhub key, scripts, and deployment. No feature claims the code does not support.
- [ ] Final bundle measurement recorded in this plan.
- [ ] `superpowers:code-reviewer` over the whole branch against the spec and both plans; fix
  what it finds, or record why not.
- [ ] Report to the user: what shipped, what was declined, the bundle number, and the merge
  decision for `redesign/terminal-v3` into `main`. Do not merge without a decision.
