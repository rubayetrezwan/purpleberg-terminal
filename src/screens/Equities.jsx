import { useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Bell, Star } from "lucide-react";
import { US_STOCKS } from "../config.js";
import { fmt, fmtK, fmtNum, fmtPct, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { pos52 } from "../lib/screener.js";
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
import { IconButton } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";
import { RangeBar } from "../ui/RangeBar.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Loading } from "../ui/Loading.jsx";

// Unit per ratio, from /api/financials: pe/pb/ps/evEbitda/currentRatio are
// multiples; roe/roa are already percentages; Yahoo returns debtToEquity as a
// percent-like number (79.55 means 79.55%).
const RATIO_UNITS = { pe: "x", pb: "x", ps: "x", evEbitda: "x", currentRatio: "x", roe: "%", roa: "%", debtToEquity: "%" };
const RATIO_LABELS = {
  pe: "P/E (TTM)", pb: "P/B", ps: "P/S", evEbitda: "EV/EBITDA",
  roe: "ROE", roa: "ROA", debtToEquity: "DEBT / EQUITY", currentRatio: "CURRENT RATIO",
};
const TABS = ["CHART", "FINANCIALS", "ESTIMATES", "RATIOS", "PROFILE"];
const RANGES = ["1mo", "3mo", "6mo", "1y", "5y"];
const TYPES = [{ value: "area", label: "AREA" }, { value: "line", label: "LINE" }, { value: "volume", label: "VOLUME" }];

function ChartTab({ symbol, range, type }) {
  const { data, loading, updatedAt } = useHistorical(symbol, range);
  const { colors, gridProps, axisProps, tooltipProps, lineProps, areaProps } = useChartTheme();
  const isMobile = useIsMobile(768);
  const rows = useMemo(
    () => data.map((d) => ({ date: d.date || "", price: d.close, high: d.high, low: d.low, volume: d.volume })),
    [data]
  );
  const showYear = range === "1y" || range === "5y";
  const interval = Math.max(1, Math.floor(rows.length / (isMobile ? 6 : 12)));
  const axis = { ...axisProps, tick: { ...axisProps.tick, fontSize: 9 } };
  const tip = { ...tooltipProps, labelFormatter: fmtTooltipDate };

  return (
    <ChartFrame height={isMobile ? 240 : 340} loading={loading && !rows.length} empty={!loading && !rows.length ? `NO CHART DATA FOR ${symbol}` : null}>
      {type === "line" ? (
        <LineChart data={rows}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
          <YAxis {...axis} domain={["auto", "auto"]} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip {...tip} formatter={(v) => fmtNum(v)} />
          <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
          <Line dataKey="high" name="HIGH" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
          <Line dataKey="low" name="LOW" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
        </LineChart>
      ) : type === "volume" ? (
        <ComposedChart data={rows}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
          <YAxis yAxisId="p" {...axis} domain={["auto", "auto"]} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
          <YAxis yAxisId="v" orientation="right" {...axis} width={48} tickFormatter={(v) => fmtK(v)} />
          <Tooltip {...tip} formatter={(v, n) => (n === "VOLUME" ? fmtK(v) : fmtNum(v))} />
          <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
        </ComposedChart>
      ) : (
        <AreaChart data={rows}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
          <YAxis {...axis} domain={["auto", "auto"]} width={56} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip {...tip} formatter={(v) => fmtNum(v)} />
          <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
        </AreaChart>
      )}
    </ChartFrame>
  );
}

function FinancialsTab({ fin, loading }) {
  const { colors, gridProps, axisProps, tooltipProps } = useChartTheme();
  const isMobile = useIsMobile(768);
  const quarters = (fin && fin.quarterlyRevenue) || [];
  const margins = Object.entries((fin && fin.margins) || {});
  return (
    <Grid2>
      <Section title="Quarterly revenue and earnings">
        <ChartFrame height={220} loading={loading && !quarters.length} empty={!loading && !quarters.length ? "NO QUARTERLY DATA" : null}>
          <BarChart data={quarters}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="quarter" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => fmtK(v)} width={52} />
            <Tooltip {...tooltipProps} formatter={(v) => fmtK(v)} />
            <Bar dataKey="revenue" name="REVENUE" fill={colors.series[0]} isAnimationActive={false} barSize={isMobile ? 10 : 18} />
            <Bar dataKey="earnings" name="EARNINGS" fill={colors.series[1]} isAnimationActive={false} barSize={isMobile ? 10 : 18} />
          </BarChart>
        </ChartFrame>
      </Section>
      <Section title="Margins">
        {loading && !margins.length ? <Loading /> : !margins.length ? <EmptyState>NO MARGIN DATA</EmptyState> : (
          <div className="pb-bars">
            {margins.map(([k, v]) => {
              // The proxy sends the string "0" for every margin it could not
              // source, including from its own catch block, so a real 0.0%
              // and "unknown" arrive identically. An em dash and no bar is the
              // honest reading, the same guard the ratios table uses.
              const n = parseFloat(v);
              const pct = Number.isFinite(n) && n !== 0 ? n : null;
              return (
                <div key={k} className="pb-bars__row">
                  <div className="pb-bars__head">
                    <span className="pb-label">{k.toUpperCase()}</span>
                    <span className="pb-bars__val">{pct == null ? "—" : `${fmt(pct, 1)}%`}</span>
                  </div>
                  <div className="pb-bars__track">
                    <i style={{ width: pct == null ? 0 : `${Math.min(Math.max(pct, 0), 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </Grid2>
  );
}

function EstimatesTab({ fin, loading }) {
  const est = (fin && fin.estimates) || {};
  const rec = (fin && fin.recommendations) || {};
  if (loading && !fin) return <Loading />;
  const bars = [
    { label: "BUY", pct: rec.buy || 0, tone: "up" },
    { label: "HOLD", pct: rec.hold || 0, tone: "warn" },
    { label: "SELL", pct: rec.sell || 0, tone: "down" },
  ];
  return (
    <Grid2>
      <Section title="Consensus estimates">
        <KVList cols={2}>
          <KV k="EPS EST" v={est.epsEstimate ? fmt(est.epsEstimate) : "—"} />
          <KV k="EPS YEAR AGO" v={est.epsPrev ? fmt(est.epsPrev) : "—"} />
          <KV k="REV GROWTH" v={est.revenueEstimate && est.revenueEstimate !== "N/A" ? est.revenueEstimate : "—"} />
          <KV k="TARGET MEAN" v={est.targetMean ? fmtNum(est.targetMean) : "—"} />
          <KV k="TARGET LOW" v={est.targetLow ? fmtNum(est.targetLow, 0) : "—"} />
          <KV k="TARGET HIGH" v={est.targetHigh ? fmtNum(est.targetHigh, 0) : "—"} />
        </KVList>
      </Section>
      <Section title="Analyst recommendations">
        {!rec.buy && !rec.hold && !rec.sell ? <EmptyState>NO RECOMMENDATIONS</EmptyState> : (
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

function RatiosTab({ fin, loading }) {
  const ratios = Object.entries((fin && fin.ratios) || {});
  if (loading && !ratios.length) return <Loading />;
  if (!ratios.length) return <EmptyState>NO RATIO DATA</EmptyState>;
  return (
    <Section title="Valuation and ratios">
      <KVList cols={2}>
        {ratios.map(([k, v]) => {
          const n = parseFloat(v);
          return <KV key={k} k={RATIO_LABELS[k] || k.toUpperCase()} v={Number.isFinite(n) && n !== 0 ? fmt(n) + (RATIO_UNITS[k] || "x") : "—"} />;
        })}
      </KVList>
    </Section>
  );
}

function ProfileTab({ fin, quote, loading }) {
  const p = (fin && fin.profile) || {};
  if (loading && !fin) return <Loading />;
  return (
    <Section title="Company profile">
      <KVList cols={2}>
        <KV k="SECTOR" v={p.sector && p.sector !== "N/A" ? p.sector : "—"} />
        <KV k="INDUSTRY" v={p.industry && p.industry !== "N/A" ? p.industry : "—"} />
        <KV k="COUNTRY" v={p.country && p.country !== "N/A" ? p.country : "—"} />
        <KV k="EMPLOYEES" v={p.employees ? fmtK(p.employees) : "—"} />
        <KV k="MKT CAP" v={quote && quote.marketCap > 0 ? fmtK(quote.marketCap) : "—"} />
        <KV k="52W RANGE" v={quote && quote.week52Low > 0 ? `${fmt(quote.week52Low, 0)} – ${fmt(quote.week52High, 0)}` : "—"} />
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

function Grid2({ children }) {
  const isMobile = useIsMobile(1024);
  return <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>{children}</div>;
}

export default function Equities() {
  const { params, query } = useRoute();
  const pool = useQuotePool();
  const watched = useStore(watchlist, (s) => s.symbols);
  const [filter, setFilter] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);

  const listMode = query.list === "all" || !watched.length ? "all" : "watch";
  const tab = TABS.includes((query.tab || "").toUpperCase()) ? query.tab.toUpperCase() : "CHART";
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const type = TYPES.some((t) => t.value === query.type) ? query.type : "area";

  const universe = useMemo(() => {
    const source = listMode === "watch" ? watched : US_STOCKS;
    return source.map((s) => pool.bySymbol.get(s) || { symbol: s, price: 0, changePercent: null });
  }, [listMode, watched, pool.bySymbol]);

  const rows = useMemo(() => {
    const q = filter.trim().toUpperCase();
    if (!q) return universe;
    return universe.filter((r) => r.symbol.includes(q) || String(r.name || "").toUpperCase().includes(q));
  }, [universe, filter]);

  const symbol = (params.symbol || (rows[0] && rows[0].symbol) || "AAPL").toUpperCase();
  // A symbol reached from the command line may be outside the tracked list;
  // retaining it puts it in the shared poll for as long as this screen is open.
  usePoolExtra(symbol);
  const quote = useQuote(symbol);
  const isWatched = watched.includes(symbol);
  const { data: fin, loading: finLoading } = useFinancialsWithRetry(symbol);

  const select = (sym) => navigate(pathFor("equities", { symbol: sym }, query));

  const listColumns = [
    { key: "symbol", label: "TICKER", align: "left", width: "40%", render: (r) => <span className="pb-eq__sym">{r.symbol}</span> },
    { key: "price", label: "LAST", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} /> : "—") },
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
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="FILTER" aria-label="Filter symbols" mono />
      </div>
      <DataTable
        label="Securities"
        columns={listColumns}
        rows={rows}
        rowKey={(r) => r.symbol}
        selectedKey={symbol}
        numbered
        navigable
        virtualize={rows.length > 60}
        height={560}
        onRowClick={(r) => select(r.symbol)}
        onRowSpace={(r) => toggleWatch(r.symbol)}
        empty="NO MATCH"
      />
    </Section>
  );

  const pct = quote ? pos52(quote) : null;
  const detail = (
    <div className="pb-eq__detail">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{symbol}</span>
        <span className="pb-eq__name pb-muted">{quote ? quote.name : ""}</span>
        {quote && quote.exchange && <Tag>{quote.exchange}</Tag>}
        {quote && quote.marketState && <Tag tone={quote.marketState === "REGULAR" ? "up" : undefined}>{quote.marketState === "REGULAR" ? "OPEN" : quote.marketState}</Tag>}
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
            onClick={() => setAlertOpen((v) => !v)}
          >
            <Bell size={13} strokeWidth={1.5} />
          </IconButton>
        </span>
      </header>

      {alertOpen && quote && (
        <div className="pb-eq__alert">
          <AlertForm symbol={symbol} currentPrice={quote.price} onDone={() => setAlertOpen(false)} />
        </div>
      )}

      <StatRow>
        <Stat label="Last" value={quote && quote.price > 0 ? fmtNum(quote.price) : "—"} size="lg" />
        <Stat label="Chg" value={quote ? fmtPct(quote.changePercent) : "—"} tone={!quote || quote.changePercent == null ? undefined : quote.changePercent >= 0 ? "up" : "down"} />
        <Stat label="Mkt cap" value={quote && quote.marketCap > 0 ? fmtK(quote.marketCap) : "—"} />
        <Stat label="P/E" value={quote && quote.pe > 0 ? `${fmt(quote.pe, 1)}x` : "—"} />
        <Stat label="Vol" value={quote && quote.volume > 0 ? fmtK(quote.volume) : "—"} />
        <Stat
          label="52W"
          value={quote && quote.week52Low > 0 ? `${fmt(quote.week52Low, 0)} – ${fmt(quote.week52High, 0)}` : "—"}
          sub={<RangeBar pct={pct == null ? null : pct * 100} lo={quote ? fmt(quote.week52Low, 0) : "—"} hi={quote ? fmt(quote.week52High, 0) : "—"} />}
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
          </div>
          <ChartTab symbol={symbol} range={range} type={type} />
        </>
      )}
      {tab === "FINANCIALS" && <FinancialsTab fin={fin} loading={finLoading} />}
      {tab === "ESTIMATES" && <EstimatesTab fin={fin} loading={finLoading} />}
      {tab === "RATIOS" && <RatiosTab fin={fin} loading={finLoading} />}
      {tab === "PROFILE" && <ProfileTab fin={fin} quote={quote} loading={finLoading} />}
    </div>
  );

  return (
    <ListDetail
      listWidth={220}
      list={list}
      detail={detail}
      mobile={{
        label: "Security",
        value: symbol,
        onChange: select,
        options: rows.map((r) => ({ value: r.symbol, label: `${r.symbol}${r.price > 0 ? ` · ${fmtNum(r.price)}` : ""}` })),
      }}
    />
  );
}
