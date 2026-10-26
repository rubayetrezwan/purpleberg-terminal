import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Bell, Star } from "lucide-react";
import { US_STOCKS } from "../config.js";
import { universeEntry } from "../data/universe.js";
import { fmt, fmtK, fmtNum, fmtPct, fmtLevel, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { exchangeLabel } from "../lib/exchange.js";
import { pos52 } from "../lib/screener.js";
import { filterRows, pickFromFilter } from "../lib/symbolSearch.js";
import { toYahooSymbol } from "../lib/ticker.js";
import { marketStateTag } from "../lib/session.js";
import { statementCurrency, CROSS_CURRENCY_RATIOS, largestRemainder, valueAxis } from "../compareUtils.js";
import { useRoute, updateQuery, navigate, pathFor } from "../router/index.jsx";
import { useQuotePool, useQuote, usePoolExtra } from "../data/quotePool.jsx";
import { useHistorical, useFinancialsWithRetry, useIsMobile } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { toggleWatch } from "../ui/watchActions.js";
import { AlertForm } from "../features/AlertForm.jsx";
import { ListDetail } from "../ui/ListDetail.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { Tabs } from "../ui/Tabs.jsx";
import { Stat, StatRow } from "../ui/Stat.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Button, IconButton } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";
import { RangeBar } from "../ui/RangeBar.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";
import { ChartKey } from "../ui/ChartKey.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Loading } from "../ui/Loading.jsx";

// Unit per ratio, from /api/financials: pe/pb/ps/evEbitda/currentRatio are
// multiples; roe/roa are already percentages; Yahoo returns debtToEquity as a
// percent-like number (79.55 means 79.55%).
const RATIO_UNITS = { pe: "x", forwardPe: "x", pb: "x", ps: "x", evEbitda: "x", currentRatio: "x", roe: "%", roa: "%", debtToEquity: "%" };
const RATIO_LABELS = {
  pe: "P/E (TTM)", forwardPe: "P/E (FWD)", pb: "P/B", ps: "P/S", evEbitda: "EV/EBITDA",
  roe: "ROE", roa: "ROA", debtToEquity: "DEBT / EQUITY", currentRatio: "CURRENT RATIO",
};
const RATIO_GROUPS = [
  { title: "Valuation", keys: ["pe", "forwardPe", "ps", "pb", "evEbitda"] },
  { title: "Returns", keys: ["roe", "roa"] },
  { title: "Balance sheet", keys: ["debtToEquity", "currentRatio"] },
];
const TABS = ["CHART", "FINANCIALS", "ESTIMATES", "RATIOS", "PROFILE"];
const RANGES = ["1mo", "3mo", "6mo", "1y", "5y"];
const TYPES = [{ value: "area", label: "AREA" }, { value: "line", label: "LINE" }, { value: "volume", label: "VOLUME" }];

// One precision per kind of figure, on every tab and in the header: multiples
// to two places (the header P/E used to read 39.9x beside 39.88x under
// RATIOS), percentages to one.
const fmtMultiple = (n) => `${fmt(n, 2)}x`;
const fmtPctPlain = (n) => `${fmt(n, 1)}%`;

// fmtK keeps a zero decimal because in a column of prices it is precision.
// On an axis or a head count it is noise: "280M", "150K", "1.5T".
const fmtKShort = (n) => fmtK(n).replace(/(\.\d*?)0+([A-Z]?)$/, "$1$2").replace(/\.([A-Z]?)$/, "$1");

// The proxy sends 0 (or "0") for any figure it could not source.
const known = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

// Two significant figures, rounded down: 283,456,000 -> 280,000,000.
function floorTwoFigures(n) {
  if (!(n > 0)) return 0;
  const unit = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.floor(n / unit) * unit;
}

function ChartTab({ symbol, range, type }) {
  const { data, loading } = useHistorical(symbol, range);
  const { colors, gridProps, axisProps, tooltipProps, lineProps, areaProps } = useChartTheme();
  const isMobile = useIsMobile(768);
  const rows = useMemo(
    () => data.map((d) => ({ date: d.date || "", price: d.close, high: d.high, low: d.low, volume: d.volume })),
    [data]
  );
  const showYear = range === "1y" || range === "5y";
  const interval = Math.max(1, Math.floor(rows.length / (isMobile ? 6 : 12)));
  const tip = { ...tooltipProps, labelFormatter: fmtTooltipDate };

  // The LINE chart also draws the daily high and low, so they set its range.
  const py = useMemo(
    () => valueAxis(rows.flatMap((r) => (type === "line" ? [r.price, r.high, r.low] : [r.price]))),
    [rows, type]
  );
  // Volume sits in the bottom quarter, under the price line: its axis runs to
  // four times the busiest day, and only two round ticks inside that quarter
  // are labelled. Scaled to the full height, the bars covered the line.
  const volMax = useMemo(() => rows.reduce((m, r) => Math.max(m, r.volume || 0), 0), [rows]);
  const volTop = floorTwoFigures(volMax);
  // The price scale gives up that bottom quarter in return, its range
  // stretched down by a third, so the line rides above the bars.
  const [p0, p1] = py.domain;
  const priceOverVolume = py.ticks ? [p0 - (p1 - p0) / 3, p1] : py.domain;
  const xAxis = <XAxis dataKey="date" {...axisProps} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />;

  return (
    <ChartFrame height="fill" minHeight={isMobile ? 240 : 340} loading={loading && !rows.length} empty={!loading && !rows.length ? `NO CHART DATA FOR ${symbol}` : null}>
      {type === "line" ? (
        <LineChart data={rows}>
          <CartesianGrid {...gridProps} />
          {xAxis}
          <YAxis {...axisProps} domain={py.domain} ticks={py.ticks} width={py.width} tickFormatter={py.format} />
          <Tooltip {...tip} formatter={(v) => fmtNum(v)} />
          <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
          <Line dataKey="high" name="HIGH" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
          <Line dataKey="low" name="LOW" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
        </LineChart>
      ) : type === "volume" ? (
        <ComposedChart data={rows}>
          <CartesianGrid {...gridProps} />
          {xAxis}
          <YAxis yAxisId="p" {...axisProps} domain={priceOverVolume} ticks={py.ticks} width={py.width} tickFormatter={py.format} />
          <YAxis
            yAxisId="v"
            orientation="right"
            {...axisProps}
            width={44}
            domain={[0, volMax * 4 || 1]}
            ticks={volTop ? [volTop / 2, volTop] : []}
            tickFormatter={fmtKShort}
          />
          <Tooltip {...tip} cursor={{ fill: colors.line, stroke: "none" }} formatter={(v, n) => (n === "VOLUME" ? fmtK(v) : fmtNum(v))} />
          <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
        </ComposedChart>
      ) : (
        <AreaChart data={rows}>
          <CartesianGrid {...gridProps} />
          {xAxis}
          <YAxis {...axisProps} domain={py.domain} ticks={py.ticks} width={py.width} tickFormatter={py.format} />
          <Tooltip {...tip} formatter={(v) => fmtNum(v)} />
          <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
        </AreaChart>
      )}
    </ChartFrame>
  );
}

// Margins run from 0 to 100%. When one is negative the track gains a zero
// mark, placed so the worst margin (clamped at -100%) fits to its left, and a
// negative margin fills leftward from it in the down colour. Before, a loss
// read as an empty bar beside a grey number, which looked like missing data.
function MarginBars({ margins }) {
  const vals = margins.map(([, v]) => known(v));
  const lo = Math.max(-100, Math.min(0, ...vals.filter((v) => v != null)));
  const span = 100 - lo;
  const zero = (-lo / span) * 100;
  return (
    <div className="pb-bars">
      {margins.map(([k], i) => {
        const pct = vals[i];
        const neg = pct != null && pct < 0;
        const width = pct == null ? 0 : (Math.min(Math.abs(Math.max(pct, lo)), 100) / span) * 100;
        return (
          <div key={k} className="pb-bars__row">
            <div className="pb-bars__head">
              <span className="pb-label">{k.toUpperCase()}</span>
              <span className={`pb-bars__val${neg ? " pb-down" : ""}`}>{pct == null ? "—" : fmtPctPlain(pct)}</span>
            </div>
            <div className="pb-bars__track pb-bars__track--signed">
              {lo < 0 && <b className="pb-bars__zero" style={{ left: `${zero}%` }} />}
              <i
                className={neg ? "pb-bars__fill--down" : undefined}
                style={{ left: `${neg ? zero - width : zero}%`, width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinancialsTab({ fin, quote, loading }) {
  const { colors, gridProps, axisProps, tooltipProps } = useChartTheme();
  const isMobile = useIsMobile(768);
  const quarters = (fin && fin.quarterlyRevenue) || [];
  const margins = Object.entries((fin && fin.margins) || {});
  // The statements' own currency, on every figure: an ADR's revenue is in its
  // home currency (TSM reports in TWD) and must not read as dollars.
  const cur = (fin && fin.financialCurrency) || (quote && quote.currency) || "";
  const withCur = (v) => (cur ? `${fmtK(v)} ${cur}` : fmtK(v));
  return (
    <Grid2 narrowRows="1fr auto">
      <Section
        title="Quarterly results"
        className="pb-eq__fill"
        meta={(
          <span className="pb-eq__meta">
            <ChartKey items={[{ label: "REVENUE", color: colors.series[0] }, { label: "EARNINGS", color: colors.series[1] }]} />
            {cur && <span>{cur}</span>}
          </span>
        )}
      >
        <ChartFrame height="fill" minHeight={220} loading={loading && !quarters.length} empty={!loading && !quarters.length ? "NO QUARTERLY DATA" : null}>
          <BarChart data={quarters}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="quarter" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtKShort} width={44} />
            <Tooltip {...tooltipProps} cursor={{ fill: colors.line, stroke: "none" }} formatter={withCur} />
            <Bar dataKey="revenue" name="REVENUE" fill={colors.series[0]} isAnimationActive={false} barSize={isMobile ? 10 : 18} />
            <Bar dataKey="earnings" name="EARNINGS" fill={colors.series[1]} isAnimationActive={false} barSize={isMobile ? 10 : 18} />
          </BarChart>
        </ChartFrame>
      </Section>
      <Section title="Margins">
        {loading && !margins.length ? <Loading /> : !margins.length ? <EmptyState>NO MARGIN DATA</EmptyState> : <MarginBars margins={margins} />}
      </Section>
    </Grid2>
  );
}

function EstimatesTab({ fin, quote, loading }) {
  const est = (fin && fin.estimates) || {};
  const rec = (fin && fin.recommendations) || {};
  if (loading && !fin) return <Loading />;
  // Split the raw analyst counts so the shares add to exactly 100; the
  // proxy's own percentages are each rounded alone and can reach 101.
  const counts = Array.isArray(rec.counts) && rec.counts.length === 3 ? rec.counts : [rec.buy, rec.hold, rec.sell];
  const [buy, hold, sell] = largestRemainder(counts);
  const bars = [
    { label: "BUY", pct: buy, tone: "up" },
    { label: "HOLD", pct: hold, tone: "warn" },
    { label: "SELL", pct: sell, tone: "down" },
  ];
  const price = quote && quote.price > 0 ? quote.price : null;
  const lo = known(est.targetLow);
  const hi = known(est.targetHigh);
  const mean = known(est.targetMean);
  const upside = price && mean ? (mean / price - 1) * 100 : null;
  const inBand = price && lo && hi && hi > lo ? ((price - lo) / (hi - lo)) * 100 : null;
  return (
    <Grid2>
      <Section title="Consensus estimates">
        <KVList cols={2}>
          <KV k="EPS EST" v={known(est.epsEstimate) != null ? fmt(est.epsEstimate) : "—"} />
          <KV k="EPS YEAR AGO" v={known(est.epsPrev) != null ? fmt(est.epsPrev) : "—"} />
          <KV k="REV GROWTH" v={est.revenueEstimate && est.revenueEstimate !== "N/A" ? est.revenueEstimate : "—"} />
          <KV k="UPSIDE TO MEAN" v={upside == null ? "—" : fmtPct(upside, 1)} tone={upside == null ? undefined : upside >= 0 ? "up" : "down"} />
          <KV k="TARGET LOW" v={lo ? fmtNum(lo) : "—"} />
          <KV k="TARGET HIGH" v={hi ? fmtNum(hi) : "—"} />
          <KV k="TARGET MEAN" v={mean ? fmtNum(mean) : "—"} />
          <KV k="TARGET MEDIAN" v={known(est.targetMedian) != null ? fmtNum(est.targetMedian) : "—"} />
        </KVList>
        {/* Where the price sits among the targets. Outside the band the
            marker pins to the end and the caption says so, rather than a
            "0% OF RANGE" that reads as sitting on the low target. */}
        {inBand != null && (
          <div className="pb-eq__targets">
            <div className="pb-label">
              LAST {fmtNum(price)} {inBand < 0 ? "BELOW THE LOW TARGET" : inBand > 100 ? "ABOVE THE HIGH TARGET" : `AT ${inBand.toFixed(0)}% OF THE TARGET RANGE`}
            </div>
            <div className="pb-range">
              <div className="pb-range__track">
                <span className="pb-range__mark" style={{ left: `${Math.min(100, Math.max(0, inBand))}%` }} />
              </div>
              <div className="pb-range__labels pb-label">
                <span>LOW {fmtNum(lo)}</span>
                <span>HIGH {fmtNum(hi)}</span>
              </div>
            </div>
          </div>
        )}
      </Section>
      <Section title="Analyst recommendations">
        {!buy && !hold && !sell ? <EmptyState>NO RECOMMENDATIONS</EmptyState> : (
          <div className="pb-bars">
            {bars.map((b) => (
              <div key={b.label} className="pb-bars__row">
                <div className="pb-bars__head">
                  <span className="pb-label">{b.label}</span>
                  <span className="pb-bars__val">{b.pct}%</span>
                </div>
                <div className="pb-bars__track">
                  <i className={`pb-bars__fill--${b.tone}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </Grid2>
  );
}

function RatiosTab({ fin, quote, loading }) {
  const ratios = (fin && fin.ratios) || {};
  const narrow = useIsMobile(1024);
  if (loading && !Object.keys(ratios).length) return <Loading />;
  if (!Object.keys(ratios).length) return <EmptyState>NO RATIO DATA</EmptyState>;
  // Ratios that divide a dollar price by a home-currency statement figure
  // print a dash, with a note saying why, rather than a confident nonsense.
  const cur = statementCurrency(fin, quote);
  const mixed = (k) => cur && CROSS_CURRENCY_RATIOS.includes(k);
  const value = (k) => {
    if (mixed(k)) return "—";
    const n = known(ratios[k]);
    if (n == null) return "—";
    return RATIO_UNITS[k] === "%" ? fmtPctPlain(n) : fmtMultiple(n);
  };
  return (
    <div className="pb-grid pb-eq__pane" style={narrow ? { gridTemplateColumns: "1fr", gridTemplateRows: "auto auto 1fr" } : { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
      {RATIO_GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <KVList>
            {g.keys.map((k) => <KV key={k} k={RATIO_LABELS[k]} v={value(k)} />)}
          </KVList>
          {cur && g.keys.some(mixed) && (
            <p className="pb-eq__note pb-muted">— {g.keys.filter(mixed).map((k) => RATIO_LABELS[k]).join(", ")}: STATEMENTS IN {cur}, PRICE IN {quote.currency}</p>
          )}
        </Section>
      ))}
    </div>
  );
}

function ProfileTab({ fin, quote, loading }) {
  const p = (fin && fin.profile) || {};
  // Sector and industry names run long; two columns cut them off on a phone.
  const isMobile = useIsMobile(768);
  if (loading && !fin) return <Loading />;
  return (
    <Section title="Company profile" className="pb-eq__pane">
      <KVList cols={isMobile ? 1 : 2}>
        <KV k="SECTOR" v={p.sector && p.sector !== "N/A" ? p.sector : "—"} />
        <KV k="INDUSTRY" v={p.industry && p.industry !== "N/A" ? p.industry : "—"} />
        <KV k="COUNTRY" v={p.country && p.country !== "N/A" ? p.country : "—"} />
        <KV k="EMPLOYEES" v={p.employees ? fmtKShort(p.employees) : "—"} />
        <KV k="MKT CAP" v={quote && quote.marketCap > 0 ? fmtK(quote.marketCap) : "—"} />
        <KV k="52W RANGE" v={quote && quote.week52Low > 0 ? `${fmtLevel(quote.week52Low)} – ${fmtLevel(quote.week52High)}` : "—"} />
      </KVList>
      {p.website && (
        <div className="pb-profile__link">
          <a href={p.website} target="_blank" rel="noopener noreferrer">{p.website}</a>
        </div>
      )}
      <p className="pb-profile__summary pb-dim">
        {p.summary || (quote ? `${quote.name} trades as ${quote.symbol}.` : "No description available.")}
      </p>
    </Section>
  );
}

// Two columns from 1024px up. The grid takes the rest of the pane, so the
// columns and the hairline between them run to the bottom of the screen
// instead of stopping under the content above a black band. Stacked in one
// column, `narrowRows` says which section takes the spare height; split
// evenly, it opened a gap under the first.
function Grid2({ narrowRows = "auto 1fr", children }) {
  const isMobile = useIsMobile(1024);
  const style = isMobile ? { gridTemplateColumns: "1fr", gridTemplateRows: narrowRows } : { gridTemplateColumns: "1fr 1fr" };
  return <div className="pb-grid pb-eq__pane" style={style}>{children}</div>;
}

export default function Equities() {
  const { params, query } = useRoute();
  const pool = useQuotePool();
  const isMobile = useIsMobile(768);
  const { colors } = useChartTheme();
  const watched = useStore(watchlist, (s) => s.symbols);
  const [filter, setFilter] = useState("");
  // The symbol the alert form was opened for. The form seeds its price once,
  // so it only counts as open while that is still the symbol on screen.
  const [alertFor, setAlertFor] = useState(null);

  const listMode = query.list === "all" || !watched.length ? "all" : "watch";
  const tab = TABS.includes((query.tab || "").toUpperCase()) ? query.tab.toUpperCase() : "CHART";
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const type = TYPES.some((t) => t.value === query.type) ? query.type : "area";

  // Names come from the universe so the filter finds "apple" before the first
  // quote has landed; a watched symbol outside it falls back to the quote's.
  const universe = useMemo(() => {
    const source = listMode === "watch" ? watched : US_STOCKS;
    return source.map((s) => {
      const q = pool.bySymbol.get(s);
      const u = universeEntry(s);
      return { symbol: s, name: (u && u.name) || (q && q.name) || "", price: q ? q.price : 0, changePercent: q ? q.changePercent : null };
    });
  }, [listMode, watched, pool.bySymbol]);

  const rows = useMemo(() => filterRows(universe, filter), [universe, filter]);

  // Without a symbol in the URL, show the head of the list, not the head of
  // the filtered list: typing in the filter must not change the security.
  const symbol = (params.symbol || (universe[0] && universe[0].symbol) || "AAPL").toUpperCase();
  // Then write it into the URL, so the security stays put when the list
  // changes under it: un-starring the head of the watchlist used to swap the
  // screen to the next stock.
  useEffect(() => {
    if (!params.symbol) navigate(pathFor("equities", { symbol }, query), { replace: true });
  }, [params.symbol]); // eslint-disable-line react-hooks/exhaustive-deps
  // A symbol reached from the command line may be outside the tracked list;
  // retaining it puts it in the shared poll for as long as this screen is open.
  usePoolExtra(symbol);
  const quote = useQuote(symbol);
  const alertOpen = alertFor === symbol;
  const isWatched = watched.includes(symbol);
  const { data: fin, loading: finLoading } = useFinancialsWithRetry(symbol);

  const select = (sym) => navigate(pathFor("equities", { symbol: sym }, query));

  // Enter is GO: the best match, or any ticker typed in full, tracked or not.
  const onFilterKey = (e) => {
    if (e.key !== "Enter") return;
    const pick = pickFromFilter(rows, filter);
    if (!pick) return;
    e.preventDefault();
    setFilter("");
    select(pick);
  };

  const typed = toYahooSymbol(filter);
  const noMatch = !filter.trim() ? "NO MATCH" : listMode === "watch" ? (
    <EmptyState action={<Button size="sm" onClick={() => updateQuery({ list: "all" })}>SEARCH ALL {US_STOCKS.length}</Button>}>
      NOT IN WATCHLIST
    </EmptyState>
  ) : typed ? (
    <EmptyState action={<Button size="sm" onClick={() => { setFilter(""); select(typed); }}>OPEN {typed}</Button>}>
      NOT TRACKED
    </EmptyState>
  ) : "NO MATCH";

  // The phone sheet is full width, so it can afford the company name.
  const listColumns = [
    isMobile
      ? {
        key: "symbol", label: "TICKER", align: "left", width: "58%",
        render: (r) => (
          <span className="pb-eq__symrow">
            <span className="pb-eq__sym">{r.symbol}</span>
            <span className="pb-eq__nm pb-muted">{r.name}</span>
          </span>
        ),
      }
      : { key: "symbol", label: "TICKER", align: "left", width: "40%", render: (r) => <span className="pb-eq__sym">{r.symbol}</span> },
    { key: "price", label: "LAST", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmtNum(v)} /> : "—") },
    { key: "changePercent", label: "CHG", render: (r) => <Change value={r.changePercent} /> },
  ];

  const list = (
    <Section
      title={listMode === "watch" ? "Watchlist" : "Tracked"}
      meta={`${rows.length}`}
      actions={
        <Segmented
          size="sm"
          label="List source"
          value={listMode}
          onChange={(v) => updateQuery({ list: v === "all" ? "all" : null })}
          options={[{ value: "watch", label: "WATCH", disabled: !watched.length }, { value: "all", label: "ALL" }]}
        />
      }
      flush
    >
      <div className="pb-eq__filter">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={onFilterKey}
          placeholder="TICKER OR NAME"
          aria-label="Filter symbols"
          mono
          enterKeyHint="go"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <DataTable
        label="Securities"
        columns={listColumns}
        rows={rows}
        rowKey={(r) => r.symbol}
        selectedKey={symbol}
        numbered
        navigable
        virtualize
        height="fill"
        onRowClick={(r) => select(r.symbol)}
        onRowSpace={(r) => toggleWatch(r.symbol)}
        empty={noMatch}
      />
    </Section>
  );

  const pct = quote ? pos52(quote) : null;
  const stateTag = quote ? marketStateTag(quote.marketState) : null;
  const detail = (
    <div className="pb-eq__detail pb-des">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{symbol}</span>
        <span className="pb-eq__name pb-muted">{(universeEntry(symbol) || {}).name || (quote ? quote.name : "")}</span>
        {quote && quote.exchange && <Tag>{exchangeLabel(quote.exchange)}</Tag>}
        {stateTag && <Tag tone={stateTag.tone}>{stateTag.label}</Tag>}
        <span className="pb-eq__tools">
          <IconButton
            label={isWatched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
            className={isWatched ? "pb-accent" : ""}
            aria-pressed={isWatched}
            onClick={() => toggleWatch(symbol)}
          >
            <Star size={13} strokeWidth={1.5} fill={isWatched ? "currentColor" : "none"} />
          </IconButton>
          <IconButton
            label="Set price alert"
            className={alertOpen ? "pb-accent" : ""}
            aria-expanded={alertOpen}
            onClick={() => setAlertFor(alertOpen ? null : symbol)}
          >
            <Bell size={13} strokeWidth={1.5} />
          </IconButton>
        </span>
      </header>

      {alertOpen && quote && (
        <div className="pb-eq__alert">
          <AlertForm symbol={symbol} currentPrice={quote.price} onDone={() => setAlertFor(null)} />
        </div>
      )}

      <StatRow>
        <Stat label="Last" value={quote && quote.price > 0 ? fmtNum(quote.price) : "—"} size="lg" />
        <Stat label="Chg" value={quote ? fmtPct(quote.changePercent) : "—"} tone={!quote || quote.changePercent == null ? undefined : quote.changePercent >= 0 ? "up" : "down"} />
        <Stat label="Mkt cap" value={quote && quote.marketCap > 0 ? fmtK(quote.marketCap) : "—"} />
        <Stat label="P/E" value={quote && quote.pe > 0 ? fmtMultiple(quote.pe) : "—"} />
        <Stat label="Vol" value={quote && quote.volume > 0 ? fmtK(quote.volume) : "—"} />
        {/* The bounds are already the value line, so the bar's caption says
            only where the price sits, in words: a bare "96%" named nothing. */}
        <Stat
          label="52W"
          value={quote && quote.week52Low > 0 ? `${fmtLevel(quote.week52Low)} – ${fmtLevel(quote.week52High)}` : "—"}
          sub={<RangeBar pct={pct == null ? null : pct * 100} lo="" hi="" label="RANGE" />}
        />
      </StatRow>

      <Tabs label="Equity views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "CHART" ? null : v })} />

      {tab === "CHART" && (
        <>
          <div className="pb-eq__toolbar">
            <Segmented size="sm" label="Chart type" value={type} onChange={(v) => updateQuery({ type: v === "area" ? null : v })} options={TYPES} />
            <Segmented
              size="sm"
              label="Range"
              value={range}
              onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })}
              options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))}
            />
            {type === "line" && (
              <ChartKey items={[{ label: "CLOSE", color: colors.series[0], line: true }, { label: "HIGH / LOW", color: colors.series[2], dashed: true }]} />
            )}
            {type === "volume" && (
              <ChartKey items={[{ label: "CLOSE", color: colors.series[0], line: true }, { label: "VOLUME", color: colors.series[2] }]} />
            )}
          </div>
          <ChartTab symbol={symbol} range={range} type={type} />
        </>
      )}
      {tab === "FINANCIALS" && <FinancialsTab fin={fin} quote={quote} loading={finLoading} />}
      {tab === "ESTIMATES" && <EstimatesTab fin={fin} quote={quote} loading={finLoading} />}
      {tab === "RATIOS" && <RatiosTab fin={fin} quote={quote} loading={finLoading} />}
      {tab === "PROFILE" && <ProfileTab fin={fin} quote={quote} loading={finLoading} />}
    </div>
  );

  return (
    <ListDetail
      listWidth={220}
      fillList
      list={list}
      detail={detail}
      mobile={{
        label: "Security",
        value: symbol,
        display: `${symbol}${quote && quote.price > 0 ? ` · ${fmtNum(quote.price)}` : ""}`,
        sheet: true,
      }}
    />
  );
}
