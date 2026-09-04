# Quiet Terminal P2: Screens Implementation Plan

> **For agentic workers:** this plan specifies contracts, layouts, and data sources per screen,
> and gives complete code only for the shared pure modules. The component kit in `src/ui/`,
> the shell in `src/shell/`, and the data layer in `src/data/` are already built and are the
> authority for prop names: read the actual files before writing a screen. Steps use checkbox
> (`- [ ]`) syntax.

**Goal:** Rebuild all eleven market screens on the Quiet Terminal kit, delete every
pre-redesign module, and leave the terminal with one design system end to end.

**Architecture:** Each screen is a route component under `src/screens/` composed only from
`src/ui/` primitives, reading data from the shared quote pool (`useQuotePool`, `useQuote`) or
its own polling hook, and driving all view state through the URL (`useRoute`, `updateQuery`).
Pure per-screen logic goes in `src/lib/` with `node:test` coverage. Portfolio is Plan P3.

**Tech Stack:** React 18, Vite 5, Recharts 2, Lucide, `node --test`. No new dependencies.

**Prerequisite:** Plan P1 (`2026-09-04-quiet-terminal-p1-foundation.md`) complete at commit
`76deed2`, 104 tests passing.

---

## Conventions

- Branch `redesign/quiet-terminal`, one commit per task, trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never use Bash heredocs to write files (apostrophes break in this shell); use Write/Edit,
  and `git commit -F <file>` for messages.
- After each screen: `npm test`, `npx vite build`, and a browser check of that route.
- Delete the old screen file in the same commit that replaces it. No `v2` names.
- Copy is terse and uppercase per spec 3.4: LAST, CHG, MKT CAP, VOL, 52W HI. No subtitles
  under section titles, no "LIVE" badges (freshness replaces them), no spinners (`Loading` is
  text), no emoji, no radius, no gradients.
- Numbers use `src/lib/format.js`. Every symbol on screen is a `<Ticker>`. Every panel is a
  `<Section>` with a mnemonic where it mirrors a function, and `meta={<Freshness …/>}` where
  it shows polled data.
- Charts use `useChartTheme()`: spread `gridProps`, `axisProps`, `tooltipProps`, and
  `lineProps`/`areaProps`. There is no `ChartGradient` any more; areas use
  `areaProps.fillOpacity`.
- Tables use `DataTable`. Lists that pick a detail use `ListDetail` with its
  `mobile={{ label, options, value, onChange }}` contract.

## File structure

Created:

| Path | Responsibility |
|---|---|
| `src/lib/screener.js` | Derived columns, presets, filter predicate, filter defaults |
| `src/lib/screener.test.js` | Tests for the above |
| `src/data/sparklines.js` | Batched 5-day close series with a client cache |
| `src/lib/breadth.js` | Advance/decline/median stats for the dashboard |
| `src/lib/breadth.test.js` | Tests for the above |
| `src/screens/Dashboard.jsx`, `Equities.jsx`, `Screener.jsx`, `Compare.jsx`, `Fx.jsx`, `Rates.jsx`, `Commodities.jsx`, `Crypto.jsx`, `Ipos.jsx`, `News.jsx` | The rebuilt screens |
| `src/ui/RangeBar.jsx` | Shared 52-week / ATH position bar (used by Equities, Commodities, Crypto, quick-look) |

Deleted by the end of P2: `src/screens/MarketDashboard.jsx`, `EquityAnalysis.jsx`,
`StockScreener.jsx`, `CompareStocks.jsx`, `FXDashboard.jsx`, `FixedIncome.jsx`,
`EconomicCalendar.jsx`, `CommoditiesDashboard.jsx`, `CryptoDashboard.jsx`, `IpoCenter.jsx`,
`NewsCenter.jsx`, `src/shared.jsx`, `src/chartTheme.jsx`, `src/hooks.js`, `src/api.js`,
`src/ThemeContext.jsx`, the `config.js` formatter re-exports, and the CSS between the
`LEGACY:BEGIN` and `LEGACY:END` sentinels.

Modified: `src/App.jsx` (drop the adapters), `src/config.js` (data only), `src/main.jsx`
(drop `ThemeProvider`), `src/theme/index.css` (screen classes; legacy block removed).

---

### Task 1: Screener logic

**Files:** create `src/lib/screener.js`, `src/lib/screener.test.js`.

- [ ] **Step 1: Write the failing test** covering: `pos52` null when the range is invalid or
  `week52Low` is 0; `offHigh` negative and null-safe; each of the six presets against a
  fixture of six rows; `matchesFilters` with an empty filter object passing everything;
  combined numeric bounds; the search term matching symbol or name case-insensitively;
  `FILTER_DEFAULTS` round-tripping through `filtersFromQuery`/`filtersToQuery`.

- [ ] **Step 2: Run it, confirm it fails** with `Cannot find module`.

- [ ] **Step 3: Implement `src/lib/screener.js`** with exactly this content:

```js
// Pure screener logic: derived columns, presets, and the filter predicate.
// No React; the screen owns state and the URL.

// Position in the 52-week range, 0 to 1, or null when the range is unusable.
export function pos52(row) {
  const lo = Number(row.week52Low);
  const hi = Number(row.week52High);
  const px = Number(row.price);
  if (!(lo > 0) || !(hi > lo) || !(px > 0)) return null;
  return Math.min(1, Math.max(0, (px - lo) / (hi - lo)));
}

// Fraction below the 52-week high (negative), or null.
export function offHigh(row) {
  const hi = Number(row.week52High);
  const px = Number(row.price);
  if (!(hi > 0) || !(px > 0)) return null;
  return px / hi - 1;
}

export const PRESETS = [
  { id: "dividend", label: "DIVIDEND", test: (r) => Number(r.dividendYield) >= 2 },
  { id: "value", label: "VALUE", test: (r) => Number(r.pe) > 0 && Number(r.pe) <= 15 },
  { id: "highbeta", label: "HIGH BETA", test: (r) => Number(r.beta) >= 1.5 },
  { id: "nearhigh", label: "NEAR 52W HI", test: (r) => Number(r.week52High) > 0 && Number(r.price) >= 0.95 * Number(r.week52High) },
  { id: "nearlow", label: "NEAR 52W LO", test: (r) => Number(r.week52Low) > 0 && Number(r.price) <= 1.1 * Number(r.week52Low) },
  { id: "megacap", label: "MEGA CAP", test: (r) => Number(r.marketCap) >= 500e9 },
];

export const FILTER_DEFAULTS = {
  q: "", exchange: "", peMin: "", peMax: "", priceMin: "", priceMax: "",
  capMin: "", yieldMin: "", betaMin: "", betaMax: "", posMin: "", posMax: "",
};

const num = (v) => (v === "" || v == null ? null : Number(v));

// A row passes when every provided bound holds. Blank fields are ignored.
// P/E bounds drop non-positive P/E so a "max 30" screen cannot include loss-makers.
export function matchesFilters(row, filters = {}) {
  const f = { ...FILTER_DEFAULTS, ...filters };
  const q = String(f.q || "").trim().toUpperCase();
  if (q && !(row.symbol.includes(q) || String(row.name || "").toUpperCase().includes(q))) return false;
  if (f.exchange && row.exchange !== f.exchange) return false;
  const pe = Number(row.pe);
  const peMin = num(f.peMin);
  const peMax = num(f.peMax);
  if (peMin != null && !(pe > 0 && pe >= peMin)) return false;
  if (peMax != null && !(pe > 0 && pe <= peMax)) return false;
  const px = Number(row.price);
  const priceMin = num(f.priceMin);
  const priceMax = num(f.priceMax);
  if (priceMin != null && !(px >= priceMin)) return false;
  if (priceMax != null && !(px <= priceMax)) return false;
  const capMin = num(f.capMin);
  if (capMin != null && !(Number(row.marketCap) >= capMin * 1e9)) return false;
  const yieldMin = num(f.yieldMin);
  if (yieldMin != null && !(Number(row.dividendYield) >= yieldMin)) return false;
  const beta = Number(row.beta);
  const betaMin = num(f.betaMin);
  const betaMax = num(f.betaMax);
  if (betaMin != null && !(beta > 0 && beta >= betaMin)) return false;
  if (betaMax != null && !(beta > 0 && beta <= betaMax)) return false;
  const pos = pos52(row);
  const posMin = num(f.posMin);
  const posMax = num(f.posMax);
  if (posMin != null && !(pos != null && pos * 100 >= posMin)) return false;
  if (posMax != null && !(pos != null && pos * 100 <= posMax)) return false;
  return true;
}

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

// Only non-default fields go in the URL, so a clean screen has a clean link.
export function filtersToQuery(filters) {
  const out = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== "" && v != null && v !== FILTER_DEFAULTS[k]) out[k] = String(v);
  }
  return out;
}

export function filtersFromQuery(query = {}) {
  const out = { ...FILTER_DEFAULTS };
  for (const k of Object.keys(FILTER_DEFAULTS)) {
    if (query[k] != null && query[k] !== "") out[k] = String(query[k]);
  }
  return out;
}
```

- [ ] **Step 4: Run the test, confirm it passes.**
- [ ] **Step 5: Commit** `lib: screener presets, derived columns, filter predicate`.

---

### Task 2: Sparklines and breadth

**Files:** create `src/data/sparklines.js`, `src/lib/breadth.js`, `src/lib/breadth.test.js`.

- [ ] **Step 1: Write the failing breadth test**: advancers, decliners, unchanged, percent
  positive, median absolute move, and the largest gainer and loser, over a fixture; an empty
  input returns zeros and nulls; rows without a `changePercent` are skipped.

- [ ] **Step 2: Implement `src/lib/breadth.js`:**

```js
// Cross-sectional breadth of a quote list. This is a snapshot of today's
// moves, not a time series: label it as such wherever it is rendered.
export function breadth(rows = []) {
  const moves = rows
    .filter((r) => r && Number.isFinite(Number(r.changePercent)) && Number(r.price) > 0)
    .map((r) => ({ symbol: r.symbol, chg: Number(r.changePercent) }));
  if (!moves.length) {
    return { total: 0, up: 0, down: 0, flat: 0, pctUp: null, medianAbs: null, best: null, worst: null };
  }
  const up = moves.filter((m) => m.chg > 0).length;
  const down = moves.filter((m) => m.chg < 0).length;
  const sortedAbs = moves.map((m) => Math.abs(m.chg)).sort((a, b) => a - b);
  const mid = Math.floor(sortedAbs.length / 2);
  const medianAbs = sortedAbs.length % 2 ? sortedAbs[mid] : (sortedAbs[mid - 1] + sortedAbs[mid]) / 2;
  const byChg = [...moves].sort((a, b) => b.chg - a.chg);
  return {
    total: moves.length,
    up,
    down,
    flat: moves.length - up - down,
    pctUp: (up / moves.length) * 100,
    medianAbs,
    best: byChg[0],
    worst: byChg[byChg.length - 1],
  };
}
```

- [ ] **Step 3: Implement `src/data/sparklines.js`** as a hook `useSparklines(symbols)` that
  returns `{ series: Map<symbol, number[]>, loading }`. Requirements: fetch
  `api.historical(sym, "5d", "1d")` with a concurrency of 4; hold results in a module-level
  `Map` cache with a 5-minute TTL so navigation does not refetch; skip symbols already
  cached; ignore failures per symbol (a missing sparkline renders as the empty
  `<Sparkline>`); cancel on unmount via a mounted flag; key the effect on the joined symbol
  list.

- [ ] **Step 4: Run tests, commit** `data,lib: five-day sparkline cache and market breadth`.

---

### Task 3: Dashboard (WEI)

**Files:** create `src/screens/Dashboard.jsx`; create `src/ui/RangeBar.jsx`; modify
`src/App.jsx`; delete `src/screens/MarketDashboard.jsx`.

Layout, top to bottom, all inside `<Page>`:

1. **Index strip.** `<Section mnemonic="WEI" title="World equity indices" meta={<Freshness/>}
   flush>` containing a `<Grid cols="repeat(5, 1fr)" colsTablet="repeat(3, 1fr)"
   colsMobile="repeat(2, 1fr)">` of ten cells, each: short name, full name (muted, 10px),
   mono value, `<Change>`. Data: `useQuotes(INDEX_SYMBOLS…, 15000)`.
2. **Three-column grid** (`1.2fr 1fr 1fr`, tablet `1fr 1fr`, mobile `1fr`):
   - **Watchlist** `<Section title="Watchlist" meta={count}>` with a `DataTable`, `numbered`,
     `navigable`, columns: Ticker (`<Ticker>`), 5-day `<Sparkline>` (from `useSparklines`),
     LAST (`Price`), CHG (`Change`), MKT CAP. Row click opens quick-look; Space stars.
     Empty state: "No symbols. Star any ticker."
   - **Movers** `<Section title="Movers" meta="from 250 tracked">`: top six gainers and five
     losers from `pool.equities`, numbered, each with a proportional bar (width
     `min(|chg| * 15, 100)%`, up or down colour) and `<Change>`.
   - **News** `<Section title="News" meta={<Freshness/>}>`: ten items from `useNewsFeed()`,
     numbered, each a link with time, publisher, a `<Ticker>` chip when `relatedSymbol` is
     set, and the headline. Opens in a new tab with `rel="noopener noreferrer"`.
3. **Second three-column grid:**
   - **Breadth** `<Section title="Breadth" meta="cross-sectional, today">`: a `StatRow` of
     ADVANCING, DECLINING, POSITIVE %, MEDIAN MOVE, plus BEST and WORST as `KV` rows using
     `breadth(pool.equities)`.
   - **Rates** `<Section title="Rates" mnemonic="YAS">`: 3M, 5Y, 10Y, 30Y yields and the
     10Y-3M spread in basis points, from `useQuotes(BOND_SYMBOLS…, 60000)`. Yahoo returns
     the yield change in percentage points, so multiply by 100 for basis points.
   - **Commodities** `<Section title="Commodities" mnemonic="CMDT">`: the eight symbols with
     price, change, and unit.

- [ ] Build it, wire `case "dashboard"` in `App.jsx` to the new screen, delete the old file,
  verify the route in the browser, commit `screens: dashboard on the kit`.

---

### Task 4: Equities (DES)

**Files:** create `src/screens/Equities.jsx`; modify `src/App.jsx`; delete
`src/screens/EquityAnalysis.jsx`.

- `<ListDetail listWidth={220}>`. **List:** a `<Segmented>` for WATCHLIST / ALL 250 (state in
  `?list=`), a filter `<Input>`, then a `DataTable` (`navigable`, `numbered`, `virtualize`
  when the row count exceeds 60) of symbol, LAST, CHG. Selecting a row navigates to
  `/equities/<symbol>` (`selectedKey` is the route symbol).
- **Detail header:** symbol, name, exchange and market-state `<Tag>`s, a star button and a
  bell button (opens the shared `<AlertForm>` inline), then a `StatRow`: LAST, CHG, MKT CAP,
  P/E, VOL, 52W with a `<RangeBar>`.
- **Tabs** (`?tab=`): CHART, FINANCIALS, ESTIMATES, RATIOS, PROFILE.
  - CHART: `<Segmented>` for AREA / LINE / VOLUME (`?type=`) and 1M / 3M / 6M / 1Y / 5Y
    (`?range=`), then `<ChartFrame>` with the Recharts chart. Keep `fmtAxisDate` with the
    year shown for 1Y and 5Y, and `fmtTooltipDate`.
  - FINANCIALS: quarterly revenue and earnings bar chart plus margin `KV` rows with bars.
  - ESTIMATES: EPS estimate, revenue growth, price target mean and range, and buy/hold/sell
    percentages as three labelled bars.
  - RATIOS: a `KVList` of the eight ratios, each with the correct unit (`x` for pe, pb, ps,
    evEbitda, currentRatio; `%` for roe, roa, debtToEquity).
  - PROFILE: sector, industry, country, employees, market cap, 52-week range, website link,
    and the business summary.
- Data: `useQuote(symbol)` from the pool, with a fallback `useQuotes([symbol])` plus
  `usePoolExtra(symbol)` for a symbol outside the tracked list; `useHistorical`;
  `useFinancialsWithRetry`.
- Symbols not in the pool must still work (the command line can reach any Yahoo symbol).

- [ ] Build, wire, delete the old file, verify `/equities/AAPL` and a non-tracked symbol,
  commit `screens: equities on the kit`.

---

### Task 5: Screener (EQS)

**Files:** create `src/screens/Screener.jsx`; modify `src/App.jsx`; delete
`src/screens/StockScreener.jsx`.

- **Header actions:** preset chips from `PRESETS` (active from `?preset=`), then saved-screen
  chips from the `savedScreens` store each with a delete affordance, then a SAVE SCREEN
  button that prompts for a name via a small inline input.
- **Filter bar:** search, exchange `<Select>` (options from the data), and numeric bounds for
  P/E, price, market cap in billions, dividend yield, beta, and 52-week position. A CLEAR
  button resets to `FILTER_DEFAULTS`. All non-default values live in the URL through
  `filtersToQuery`.
- **Table:** virtualised `DataTable` (`height` from a container measurement or a fixed 560),
  `numbered`, `navigable`, sortable, columns: Ticker, NAME, LAST, CHG %, MKT CAP, P/E, VOL,
  BETA, DIV %, 52W POS (percent), OFF HIGH (percent), EXCH. Row click opens quick-look.
  Section meta shows the result count and freshness.
- Rows come from `pool.equities` filtered by `matchesFilters` and, when a preset is active,
  its `test`.

- [ ] Build, wire, delete the old file, verify a preset plus a saved screen surviving reload,
  commit `screens: screener with presets and saved screens`.

---

### Task 6: Compare (COMP)

**Files:** create `src/screens/Compare.jsx`; modify `src/App.jsx`; delete
`src/screens/CompareStocks.jsx`.

Two ticker `<Input>`s driven by `?a=` and `?b=`, a COMPARE button, SWAP, and CLEAR. Then:
side-by-side `KVList`s of the two quotes; a normalised percent-from-start `LineChart` using
the existing `normalizeToPct` and `alignTimelines` from `src/compareUtils.js` (keep that
module and its tests) with a range `<Segmented>`; fundamentals and ratios rows with the
better value highlighted via `winnerOf`; and recent headlines per symbol. Empty state until
both symbols are set.

- [ ] Build, wire, delete the old file, verify, commit `screens: compare on the kit`.

---

### Task 7: FX (WFX)

**Files:** create `src/screens/Fx.jsx`; modify `src/App.jsx`; delete
`src/screens/FXDashboard.jsx`.

`<ListDetail>` over `FX_SYMBOLS`, selection in the route (`/fx/EURUSD`, the six-letter slug
mapping to `EURUSD=X`). List rows: pair, rate to four decimals (two for JPY quotes), change.
Detail: header with the pair and a fallback `<Tag>` when the quote came from the daily
fallback (`exchange === "FX"`), a `StatRow` (RATE, DAY RANGE in pips, CHG, HI, LO), a chart
with a range `<Segmented>`, and the converter (amount input, converted output, and the rate
line). Keep the honest pip range rather than a fabricated spread, and keep the note that
Yahoo does not publish bid/ask for spot FX.

- [ ] Build, wire, delete the old file, verify a BDT cross (synthetic) and a major, commit
  `screens: fx on the kit`.

---

### Task 8: Rates & Macro (YAS)

**Files:** create `src/screens/Rates.jsx`; modify `src/App.jsx`; delete
`src/screens/FixedIncome.jsx` and `src/screens/EconomicCalendar.jsx`.

Tabs in `?tab=` (`curve` default, `calendar`):

- **CURVE:** the yield curve `<ChartFrame>` (3M, 5Y, 10Y, 30Y), a treasury `DataTable`
  (tenor, yield, change in basis points), and a spreads `KVList` (10Y-3M, 30Y-10Y, curve
  shape normal or inverted). Also the `/api/treasury-rates` panel, showing an em dash and a
  muted state per tenor when a value is missing.
- **CALENDAR:** the economic calendar `DataTable` (date, time ET, country `<Tag>`, event,
  actual, forecast, previous, impact `<Tag>`), an impact `<Segmented>` (ALL / HIGH) in
  `?impact=`, and a manual refresh. Mobile renders stacked rows rather than a wide table.
- The old "data sources" link list is gone; it lives in Settings › About.

- [ ] Build, wire (including the `ECO` alias landing on `?tab=calendar`), delete both old
  files, verify, commit `screens: rates and macro on the kit`.

---

### Task 9: Commodities (CMDT) and Crypto (CRYP)

**Files:** create `src/screens/Commodities.jsx` and `src/screens/Crypto.jsx`; modify
`src/App.jsx`; delete `src/screens/CommoditiesDashboard.jsx` and
`src/screens/CryptoDashboard.jsx`.

Both are `<ListDetail>` with route-driven selection and three tabs. Keep everything the old
screens got right and carry it over verbatim in behaviour:

- **Commodities:** the static `CONTRACT_SPECS` table, `extractContractMonth` for the
  front-month label, the cents-versus-dollars axis formatting for grains, period returns from
  trading-day offsets, the 52-week `<RangeBar>`, and the front-month continuous-series note.
- **Crypto:** `useCryptoMarkets` and `useCryptoChart`, the id-plus-symbol selection that
  survives a CoinGecko-to-CoinPaprika failover, `priceDecimals` precision by magnitude,
  calendar-day period returns, the ATL-to-ATH `<RangeBar>`, supply utilisation, and the
  data-source note. Keep the honest empty state naming both upstreams and our own limiter.

- [ ] Build both, wire, delete both old files, verify, commit
  `screens: commodities and crypto on the kit`.

---

### Task 10: IPOs (IPO) and News (TOP)

**Files:** create `src/screens/Ipos.jsx` and `src/screens/News.jsx`; modify `src/App.jsx`;
delete `src/screens/IpoCenter.jsx` and `src/screens/NewsCenter.jsx`.

- **IPOs:** the curated `IPO_2026` `DataTable` (rank, company with sector beneath, `<Ticker>`
  or an em dash, date, raised, price, change, valuation, status `<Tag>`) using
  `mergeLiveQuotes` and `ipoMarketValue` from `src/ipoUtils.js` (keep that module and its
  tests), with the provenance footnote; then the live Finnhub calendar table, or the
  "add a key" note when `configured` is false, or an empty-window message.
- **News:** a filter `<Input>` bound to `?q=`, then the feed grouped into TODAY and EARLIER,
  numbered, each row time, publisher `<Tag>`, `<Ticker>` chip, and headline. Section meta
  shows the story count and freshness. Keep the local-timezone label.

- [ ] Build both, wire, delete both old files, verify, commit `screens: ipos and news on the kit`.

---

### Task 11: Delete the legacy layer

**Files:** delete `src/shared.jsx`, `src/chartTheme.jsx`, `src/hooks.js`, `src/api.js`,
`src/ThemeContext.jsx`; modify `src/config.js`, `src/main.jsx`, `src/theme/index.css`.

- [ ] **Step 1:** confirm nothing imports them: `grep -rn "shared\|chartTheme\|ThemeContext\|from \"../hooks\"\|from \"../api\"" src`
  returns only `src/data/hooks.js` and `src/data/api.js` self-references.
- [ ] **Step 2:** in `src/config.js` remove the formatter re-export line (screens import from
  `src/lib/format.js` directly). Keep the ticker lists, `SECTORS`, and `IPO_2026`.
- [ ] **Step 3:** in `src/main.jsx` drop `ThemeProvider`.
- [ ] **Step 4:** delete every line between `/* === LEGACY:BEGIN … */` and
  `/* === LEGACY:END === */` inclusive, and the "the LEGACY block at the bottom is deleted in
  P2" clause in the file header comment.
- [ ] **Step 5:** `npm test`, `npx vite build`, re-measure the gzip total against the
  baseline (`73cb96e`, 226.6 kB) and record it. Guardrail 4 must hold here.
- [ ] **Step 6:** commit `chore: delete the pre-redesign UI layer`.

---

### Task 12: Verification pass

- [ ] Every route in both themes and both densities at 375, 768, and 1440, with the console
  and failed-request logs clean.
- [ ] Keyboard-only pass on Equities and Screener: `/` to the command line, arrows and Enter
  in the list, digits 1 to 9, Space to star, Esc through every layer, `?` for the sheet.
- [ ] Deep links: `/equities/AAPL?tab=ratios`, `/screener?preset=value&sort=pe`,
  `/compare?a=AAPL&b=MSFT`, `/rates?tab=calendar`, `/crypto/bitcoin`, reload and back on each.
- [ ] Reduced motion on; confirm the price flash still clears.
- [ ] Screenshots of each screen in dark, plus Dashboard and Equities in light and at 375px.
- [ ] Record the results in this plan, mirroring P1's verification table, and commit.

## Out of scope (Plan P3)

Portfolio (transactions, time-weighted returns versus the S&P 500, allocation, risk metrics),
the `migratePortfolio` cutover, the README rewrite, the final bundle measurement, and the
code-reviewer pass before merge.
