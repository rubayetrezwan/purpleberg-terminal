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

- [x] **Step 1:** tests first, covering average cost across two buys, a partial sell realising
  P&L, an oversized sell landing in `rejected`, a full exit keeping realised P&L, stale rows
  excluded from the totals but counted, a value series with a price gap, a Dietz day with a
  cash flow, a flat series giving zero volatility, `riskMetrics` returning null under 20
  points, beta of a series against itself being 1, and a CSV round trip with one bad line.
- [x] **Step 2:** implement, `npm test`, commit `lib: portfolio accounting, dietz returns, and risk metrics`.

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

- [x] **Step 1:** build the screen and the form, wire the route, run the cutover.
- [x] **Step 2:** verify in the browser: sample load, add and delete a transaction, an oversized
  sell refused, CSV round trip, all four tabs, 375px.
- [x] **Step 3:** `npm test`, `npx vite build`, commit `screens: portfolio on transactions with returns and risk`.

---

## Task 3: Delete the legacy layer (was P2 Task 11)

**Files:** delete `src/shared.jsx`, `src/chartTheme.jsx`, `src/hooks.js`, `src/api.js`,
`src/ThemeContext.jsx`; modify `src/config.js`, `src/main.jsx`, `src/theme/index.css`.

- [x] **Step 1:** `grep -rn "shared\|chartTheme\|ThemeContext\|from \"../hooks\"\|from \"../api\"" src`
  returns only the `src/data/**` self-references.
- [x] **Step 2:** drop the formatter re-exports from `src/config.js`, keeping the ticker lists,
  `SECTORS`, and `IPO_2026`.
- [x] **Step 3:** drop `ThemeProvider` from `src/main.jsx`.
- [x] **Step 4:** delete everything between the `LEGACY:BEGIN` and `LEGACY:END` sentinels in
  `src/theme/index.css`, and the sentence about them in the file header.
- [x] **Step 5:** `npm test` (151 passing), `npx vite build` clean, and both sides re-measured
  with one script (gzip -9 over every emitted file, and over the transitive chunk graph of the
  entry plus the default screen).

| Measure | Baseline `73cb96e` | Terminal v3.0 | Delta |
|---|---|---|---|
| Total gzip, all of `dist` | 226.7 kB | 243.1 kB | +16.4 kB (+7.2%) |
| First load (entry + CSS + default screen) | 67.2 kB | 87.7 kB | +20.5 kB (+30%) |
| CSS | 3.5 kB | 6.4 kB | +2.9 kB |

(Re-measured at the end of the branch, after the review fixes; it was 242.2 kB before them.)

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

Run against the Vite dev server with the live proxy on 2026-09-06. The Browser pane was hidden
for most of it, which matters: a hidden pane reports `window.innerWidth` 0, never fires
`requestAnimationFrame`, does not fire native focus events (`document.hasFocus()` is false), and
pauses the app's own polling by design. Widths therefore come from viewport emulation, polling
was resumed by overriding `document.visibilityState`, focus was driven by dispatching `focusin`
alongside `.focus()`, and clicks that the pane could not hit-test were dispatched on the
element. Every "pass" below is a value read out of the live DOM, not an inference.

| Check | Result |
|---|---|
| `/` Dashboard | 7 sections, 27 rows, breadth 85 advancing / 164 declining / 34% / 1.04% |
| `/equities/AAPL?tab=ratios` | Deep link opens the ratios tab, 8 rows, no overflow |
| `/equities/NVDA` at 768 | 230.36, +0.84%, 5.56T; sidebar shown, no mobile tabs |
| `/screener?preset=value&sort=pe` | Preset and sort applied: "33 of 249", SPG first at P/E 14.9 |
| `/compare?a=AAPL&b=MSFT` | Both legs live: LAST 319.97, P/E 37.6x, BETA 1.08, no empty states |
| `/fx` | 14 pairs, 54 price cells |
| `/rates` | 3M 3.76%, 10Y 4.78%, 30Y 5.25%, 10Y-3M 103 bp, CURVE SHAPE NORMAL |
| `/rates?tab=calendar` | 26 events, times ET, first row German Prelim CPI |
| `/commodities` | 8 rows, 91.48 +0.20% with the 52-week range 92.17 / 88.72 |
| `/crypto` and `/crypto/bitcoin` | 20 coins; BTC $80,053 with MAJOR and RANK 1 |
| `/ipos` | 25 curated rows, SpaceX live at 147.95, calendar shows the add-a-key state |
| `/news?q=apple` | Filter deep link narrows 18 stories to 3; typing keeps history flat |
| `/portfolio` all four tabs | Sample loaded at real closes; vol 16.1%, max DD -17.4%, VaR 1.60%, Sharpe 0.98, beta 0.74; sectors Technology 65.4% / Financial Services 18.2% / Energy 16.3% |
| `/settings` | RELEASE reads TERMINAL V3.0, VERSION 3.0.0, key status from `/api/status` |
| Widths 375 / 768 / 1440 | No page-level horizontal scroll anywhere; wide tables scroll inside their own container; mobile tabs replace the sidebar and tape at 375; Portfolio stats wrap to 2 columns with no clipped values |
| Light theme, comfortable density | Tokens repaint (`--row-h` 30px, bg #f4f4f1, up #15803d, down #b91c1c) and persist across reloads |
| Keyboard in the Screener grid | Roving focus 2 → 3 → 4 → 3, Home → 0, End → 26; Enter opens quick-look with live data; Escape closes it and returns focus to the row; `?` opens the KEYBOARD sheet and Escape closes it; Space stars the focused row with an UNDO toast |
| `/` to the command line | Opens the suggestion popover; the caret lands only once `requestAnimationFrame` runs, which a hidden pane never does — verified as an environment limit, not a code path |
| Browser back | pushState to `/rates?tab=calendar` then `/crypto/bitcoin`, back returns to the calendar and re-renders it |
| Console and network | No console errors; every `/api/*` request 200, user symbols ordered first in the pool request |

**Fixed during this pass:** the price flash cleared only on `animationend`. This environment
reports `prefers-reduced-motion: reduce`, which collapses the animation to 0.001ms, and no
`animationend` arrived within 1.5s in a hidden pane — a flash that never ends leaves the cell
tinted permanently. `Price` now clears the flash on a 700ms timer as well, with the animation
as the fast path.

**Known behaviour, not fixed:** roving focus in `DataTable` is positional, so when a live poll
re-sorts a table the cursor stays at the same row number rather than following the symbol.
Observed on the Screener, where Space starred the symbol that had moved into the focused row.
Keying focus to `rowKey` would fix it and is the right change if it ever bites; it touches every
table, so it is not worth making at the end of the project.

- [x] Recorded here and committed.

---

## Task 5: Release

- [x] README rewritten (`2a52dd9`). Every claim checked against the code: mnemonics against
  `router/routes.js`, the 2027 holiday horizon against `marketHolidays.js`, the rate limit, body
  limit and cache ceiling against `server/index.js`, 250 tickers and 25 IPOs against
  `config.js`, the build command against `render.yaml`.
- [x] Final bundle measurement recorded in Task 3 above.
- [x] Deployment path exercised, which nothing had done before: `npx vite build` then the
  Express server alone on `:3001` serves the built app, resolves the SPA deep link
  `/portfolio?tab=risk`, and answers `/api/*` same-origin — the treasury screen renders live
  yields with basis-point changes and a clean console. Storage is origin-scoped, so the
  portfolio on `:3001` is correctly separate from the one on `:5173`.
- [x] Guardrails 1, 2, 3 and 5 hold; guardrail 4 does not (Task 3). Guardrail 3 spot-checked in
  the DOM: `aria-current="page"` on the active nav item, `role="grid"` with labels on the
  navigable tables, `aria-sort` flipping between ascending and descending on the sorted column,
  an `aria-live="polite"` toast region, `:focus-visible` and `prefers-reduced-motion` rules
  present. No emoji, no spinners, no radius, no gradients, no blur, and one font family in the
  stylesheet; the only `box-shadow` uses are hard inset accent bars for selection.
- [x] Fixed while checking guardrail 3: an unknown `?sort=` key left the screener in raw pool
  order with no header marked sorted (`73c92f7`).
- [x] `superpowers:code-reviewer` over the whole branch. It read the spec, all three plans,
  every file under `src/`, ran the suite, and probed the numeric claims against the real
  modules. Findings and outcomes (`38692e4`):

| Severity | Finding | Outcome |
|---|---|---|
| Critical | Portfolio closes were fetched for open symbols only while the value series covered every transacted symbol, so a closed position contributed nothing on the days it was held while its flows still counted | Fixed. Probed: +1236.8% where the truth is +33.9% on a book with one exit. The sample portfolio has no sells, which is why the earlier pass missed it |
| High | `useHistorical`, `useFinancials` and `useFinancialsWithRetry` kept the previous symbol's data, so one company's profile, ratios and chart sat under another's header | Fixed; all three clear on a symbol change |
| High | FX labelled the current rate as the session OPEN | Fixed; the quote's `open` is carried through |
| High | Day P&L folded a live row with no previous close in as a flat zero and did not count it stale | Fixed; covers only rows that have one, and reports the rest |
| Medium | YTD measured from the first row of the loaded window | Fixed; runs from last year's final close, null when unreachable |
| Medium | Crypto stamped a fresh timestamp on an empty poll | Fixed |
| Medium | Dashboard printed "0 bp" for a null yield change; margins printed "0.0%" for unsourced margins; Compare hid a real zero; the calendar restamped on an empty scrape; the curve bridged a missing tenor | All fixed |
| Medium | Movers duplicated rows and React keys below eleven usable movers | Fixed |
| Medium | A letter key inside a modal focused the command line behind the scrim | Fixed; an open layer owns the keyboard except Escape |
| Medium | In-cell star buttons were invisible tab stops, two per row, defeating the roving tabindex | Fixed via a grid context; Space and Enter wired on the IPO and holdings tables so every symbol table matches |
| Medium | A Dietz day with no base was recorded as a flat return, padding the risk gate | Fixed; no return is reported for a day the portfolio did not exist |
| Low | Em dashes coloured green (`null >= 0`), negative VaR printed raw, zero drawdown in red, phantom position from a rejected-only sell, search race, Space swallowed with no listener, focus lost on row delete, no `h1`, News filter out of step with Back/Forward | All fixed |
| — | Bundle size, and the SessionClock label that follows spec 7.8 as written | Not changed; recorded above and in the spec |

  One reviewer claim did not survive checking: the "acts on the wrong row" symptom I had
  recorded in Task 4 turned out to be a missing `await` in my own probe, not the app. The
  identity-based cursor was still worth doing — tables sorted by a moving value do reshuffle
  between polls — and it is verified to survive polling, keyboard navigation, Enter, Space,
  and an off-screen tracked row falling back to a rendered one.

- [x] Reported, and the user asked for a final revision and the merge. `redesign/terminal-v3`
  merged into `master` (the repo has no `main`) as `a761d75`, a `--no-ff` merge, after a last
  revision pass: `IconButton` was unused because it lacked `pb-reset`, so five hand-rolled
  copies in quick-look and Equities were folded into it (`91a4412`), and two unreferenced
  imports were dropped. No remote exists, so nothing was pushed.
