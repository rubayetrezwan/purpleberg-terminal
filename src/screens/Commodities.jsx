import { useMemo } from "react";
import { AreaChart, Area, LineChart, Line, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { COMMODITY_SYMBOLS } from "../config.js";
import { fmt, fmtK, fmtNum, fmtPct, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { periodReturns, TRADING_DAY_OFFSETS } from "../lib/returns.js";
import { useRoute, updateQuery, navigate, pathFor } from "../router/index.jsx";
import { useQuotes, useHistorical, useIsMobile } from "../data/hooks.js";
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
import { RangeBar } from "../ui/RangeBar.jsx";
import { PeriodReturns } from "../ui/PeriodReturns.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

// Yahoo's quote endpoint does not expose futures contract specs, so these are
// static reference data from each exchange's rulebook.
const CONTRACT_SPECS = {
  "CL=F": { exchange: "NYMEX", contractSize: "1,000 barrels", tickSize: "$0.01 / bbl", tickValue: "$10.00", category: "Energy" },
  "BZ=F": { exchange: "ICE", contractSize: "1,000 barrels", tickSize: "$0.01 / bbl", tickValue: "$10.00", category: "Energy" },
  "GC=F": { exchange: "COMEX", contractSize: "100 troy oz", tickSize: "$0.10 / oz", tickValue: "$10.00", category: "Precious metal" },
  "SI=F": { exchange: "COMEX", contractSize: "5,000 troy oz", tickSize: "$0.005 / oz", tickValue: "$25.00", category: "Precious metal" },
  "NG=F": { exchange: "NYMEX", contractSize: "10,000 MMBtu", tickSize: "$0.001 / MMBtu", tickValue: "$10.00", category: "Energy" },
  "HG=F": { exchange: "COMEX", contractSize: "25,000 lbs", tickSize: "$0.0005 / lb", tickValue: "$12.50", category: "Industrial metal" },
  "ZW=F": { exchange: "CBOT", contractSize: "5,000 bushels", tickSize: "¢0.25 / bu", tickValue: "$12.50", category: "Agriculture" },
  "ZC=F": { exchange: "CBOT", contractSize: "5,000 bushels", tickSize: "¢0.25 / bu", tickValue: "$12.50", category: "Agriculture" },
};

// Yahoo names the front month verbosely ("Crude Oil May 26", "Chicago SRW
// Wheat Futures,May-2026"); pull out just the contract month.
const MONTH_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]?(\d{2,4})/i;
function contractMonth(longName) {
  if (!longName) return "";
  const m = String(longName).match(MONTH_RE);
  if (!m) return "";
  const yr = m[2].length === 4 ? m[2].slice(-2) : m[2];
  return `${m[1].slice(0, 3).toUpperCase()} '${yr}`;
}

const TABS = ["CHART", "STATS", "SPEC"];
const RANGES = ["1mo", "3mo", "6mo", "1y", "5y"];
const TYPES = [{ value: "area", label: "AREA" }, { value: "line", label: "LINE" }, { value: "volume", label: "VOLUME" }];
const cmdSymbols = COMMODITY_SYMBOLS.map((c) => c.symbol);
const slugOf = (symbol) => symbol.replace("=F", "");
const symbolOf = (slug) => `${String(slug || "").toUpperCase()}=F`;

export default function Commodities() {
  const { params, query } = useRoute();
  const tab = TABS.includes((query.tab || "").toUpperCase()) ? query.tab.toUpperCase() : "CHART";
  const range = RANGES.includes(query.range) ? query.range : "6mo";
  const type = TYPES.some((t) => t.value === query.type) ? query.type : "area";
  const { data, loading, updatedAt, intervalMs } = useQuotes(cmdSymbols, 20000);
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, lineProps, areaProps } = useChartTheme();

  const rows = useMemo(
    () => COMMODITY_SYMBOLS.map((c) => {
      const q = data.find((d) => d.symbol === c.symbol) || {};
      const spec = CONTRACT_SPECS[c.symbol] || {};
      // "=F" is a continuous front-month series: keep the clean config name
      // and show the rolling contract month separately.
      return { ...q, ...c, spec, contract: contractMonth(q.longName || q.shortName || q.name) };
    }),
    [data]
  );

  const requested = params.symbol ? symbolOf(params.symbol) : null;
  const selected = rows.find((r) => r.symbol === requested) || rows[0];
  const symbol = selected.symbol;
  const isCents = String(selected.unit || "").startsWith("¢");
  const money = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : `${isCents ? "¢" : "$"}${fmtNum(v, d)}`);

  const { data: hist, loading: histLoading } = useHistorical(symbol, range);
  const chartRows = useMemo(
    () => hist.map((d) => ({ date: d.date || "", price: d.close, high: d.high, low: d.low, volume: d.volume })),
    [hist]
  );
  const returns = useMemo(() => periodReturns(hist, TRADING_DAY_OFFSETS), [hist]);
  const showYear = range === "1y" || range === "5y";
  const interval = Math.max(1, Math.floor(chartRows.length / (isMobile ? 6 : 12)));
  const axis = { ...axisProps, tick: { ...axisProps.tick, fontSize: 9 } };
  const tip = { ...tooltipProps, labelFormatter: fmtTooltipDate };

  const select = (sym) => navigate(pathFor("commodities", { symbol: slugOf(sym) }, query));

  const listColumns = [
    { key: "name", label: "COMMODITY", align: "left", render: (r) => <span className="pb-eq__sym">{r.name}</span> },
    { key: "price", label: "LAST", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmtNum(v)} /> : "—") },
    { key: "changePercent", label: "CHG", render: (r) => <Change value={r.changePercent} /> },
  ];

  const list = (
    <Section title="Commodities" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      <DataTable
        label="Commodity futures"
        columns={listColumns}
        rows={rows}
        rowKey={(r) => r.symbol}
        selectedKey={symbol}
        numbered
        navigable
        loading={loading && !data.length}
        onRowClick={(r) => select(r.symbol)}
        empty="NO DATA"
      />
    </Section>
  );

  const yearPct = selected.week52High > selected.week52Low && selected.week52Low > 0 && selected.price > 0
    ? ((selected.price - selected.week52Low) / (selected.week52High - selected.week52Low)) * 100
    : null;

  const detail = (
    <div className="pb-eq__detail">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{selected.name}</span>
        <span className="pb-eq__name pb-muted">{symbol}</span>
        {selected.spec.exchange && <Tag>{selected.spec.exchange}</Tag>}
        {selected.spec.category && <Tag>{selected.spec.category.toUpperCase()}</Tag>}
        {selected.contract && <span className="pb-muted">FRONT MONTH {selected.contract}</span>}
      </header>

      <StatRow>
        <Stat label={`Last (${selected.unit || ""})`} value={selected.price > 0 ? fmtNum(selected.price) : "—"} size="lg" />
        <Stat label="Chg" value={selected.changePercent == null ? "—" : fmtPct(selected.changePercent)} tone={selected.changePercent == null ? undefined : selected.changePercent >= 0 ? "up" : "down"} />
        <Stat label="Hi" value={selected.high > 0 ? fmtNum(selected.high) : "—"} />
        <Stat label="Lo" value={selected.low > 0 ? fmtNum(selected.low) : "—"} />
        <Stat label="Vol" value={selected.volume > 0 ? fmtK(selected.volume) : "—"} />
      </StatRow>

      <Tabs label="Commodity views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "CHART" ? null : v })} />

      {tab === "CHART" && (
        <>
          <div className="pb-eq__toolbar">
            <Segmented size="sm" label="Chart type" value={type} onChange={(v) => updateQuery({ type: v === "area" ? null : v })} options={TYPES} />
            <Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "6mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />
          </div>
          <ChartFrame height={isMobile ? 240 : 340} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? `NO HISTORY FOR ${selected.name}` : null}>
            {type === "line" ? (
              <LineChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis {...axis} domain={["auto", "auto"]} width={60} tickFormatter={(v) => money(v, v >= 100 ? 0 : 2)} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
                <Line dataKey="high" name="HIGH" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
                <Line dataKey="low" name="LOW" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />
              </LineChart>
            ) : type === "volume" ? (
              <ComposedChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis yAxisId="p" {...axis} domain={["auto", "auto"]} width={60} tickFormatter={(v) => money(v, v >= 100 ? 0 : 2)} />
                <YAxis yAxisId="v" orientation="right" {...axis} width={48} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...tip} formatter={(v, n) => (n === "VOLUME" ? fmtK(v) : money(v))} />
                <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis {...axis} domain={["auto", "auto"]} width={60} tickFormatter={(v) => money(v, v >= 100 ? 0 : 2)} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
              </AreaChart>
            )}
          </ChartFrame>
        </>
      )}

      {tab === "STATS" && (
        <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <Section title="Price action" meta={selected.unit || ""}>
            <KVList cols={2}>
              <KV k="OPEN" v={selected.open > 0 ? fmtNum(selected.open) : "—"} />
              <KV k="LAST" v={selected.price > 0 ? fmtNum(selected.price) : "—"} />
              <KV k="DAY HI" v={selected.high > 0 ? fmtNum(selected.high) : "—"} />
              <KV k="DAY LO" v={selected.low > 0 ? fmtNum(selected.low) : "—"} />
              <KV k="DAY RANGE" v={selected.high > 0 && selected.low > 0 ? fmtNum(selected.high - selected.low) : "—"} />
              <KV k="VOL" v={selected.volume > 0 ? fmtK(selected.volume) : "—"} />
              <KV k="52W HI" v={selected.week52High > 0 ? fmtNum(selected.week52High) : "—"} />
              <KV k="52W LO" v={selected.week52Low > 0 ? fmtNum(selected.week52Low) : "—"} />
            </KVList>
            {yearPct != null && (
              <div className="pb-eq__rangewrap">
                <RangeBar pct={yearPct} lo={fmtNum(selected.week52Low, 0)} hi={fmtNum(selected.week52High, 0)} />
              </div>
            )}
          </Section>
          <Section title="Period returns" meta="trading-day offsets">
            <PeriodReturns
              returns={returns}
              note="Offsets are 5, 21, 63, 126, and 252 trading days from the loaded window. Extend the chart range to unlock longer periods. YTD measures from last year's final close and only appears once the range reaches back that far."
            />
          </Section>
        </div>
      )}

      {tab === "SPEC" && (
        <Section title="Contract specification" meta={`${symbol} front month`}>
          <KVList cols={2}>
            <KV k="YAHOO SYMBOL" v={symbol} />
            <KV k="EXCHANGE" v={selected.spec.exchange || "—"} />
            <KV k="CATEGORY" v={selected.spec.category || "—"} />
            <KV k="CONTRACT SIZE" v={selected.spec.contractSize || "—"} />
            <KV k="QUOTE UNIT" v={selected.unit || "—"} />
            <KV k="TICK SIZE" v={selected.spec.tickSize || "—"} />
            <KV k="TICK VALUE" v={selected.spec.tickValue || "—"} />
            <KV k="FRONT MONTH" v={selected.contract || "—"} />
          </KVList>
          <div className="pb-form__hint pb-muted">
            Yahoo publishes a continuous front-month series for each futures ticker, so roll
            effects can distort returns around expiry, especially in energy. Contract specs are
            static reference data from each exchange rulebook, not from the quote feed.
          </div>
        </Section>
      )}
    </div>
  );

  return (
    <ListDetail
      listWidth={200}
      list={list}
      detail={detail}
      mobile={{
        label: "Commodity",
        value: symbol,
        onChange: select,
        options: rows.map((r) => ({ value: r.symbol, label: `${r.name}${r.price > 0 ? ` · ${fmtNum(r.price)}` : ""}` })),
      }}
    />
  );
}
