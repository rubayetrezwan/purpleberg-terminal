import { useMemo } from "react";
import { AreaChart, Area, LineChart, Line, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { COMMODITY_SYMBOLS } from "../config.js";
import { fmtK, fmtNum, fmtPct, fmtLevel, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { niceTicks, monthTicks } from "../lib/axis.js";
import { contractMonth, hasRollLull } from "../lib/futures.js";
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
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

// Yahoo's quote endpoint does not expose futures contract specs, so these are
// static reference data from each exchange's rulebook.
const CONTRACT_SPECS = {
  "CL=F": { exchange: "NYMEX", contractSize: "1,000 BBL", tickSize: "$0.01 / BBL", tickValue: "$10.00", category: "ENERGY" },
  "BZ=F": { exchange: "ICE", contractSize: "1,000 BBL", tickSize: "$0.01 / BBL", tickValue: "$10.00", category: "ENERGY" },
  "GC=F": { exchange: "COMEX", contractSize: "100 TROY OZ", tickSize: "$0.10 / OZ", tickValue: "$10.00", category: "PRECIOUS METAL" },
  "SI=F": { exchange: "COMEX", contractSize: "5,000 TROY OZ", tickSize: "$0.005 / OZ", tickValue: "$25.00", category: "PRECIOUS METAL" },
  "NG=F": { exchange: "NYMEX", contractSize: "10,000 MMBTU", tickSize: "$0.001 / MMBTU", tickValue: "$10.00", category: "ENERGY" },
  "HG=F": { exchange: "COMEX", contractSize: "25,000 LB", tickSize: "$0.0005 / LB", tickValue: "$12.50", category: "INDUSTRIAL METAL" },
  "ZW=F": { exchange: "CBOT", contractSize: "5,000 BU", tickSize: "¢0.25 / BU", tickValue: "$12.50", category: "AGRICULTURE" },
  "ZC=F": { exchange: "CBOT", contractSize: "5,000 BU", tickSize: "¢0.25 / BU", tickValue: "$12.50", category: "AGRICULTURE" },
};

const TABS = ["CHART", "STATS", "SPEC"];
const RANGES = ["1mo", "3mo", "6mo", "1y", "5y"];
const TYPES = [{ value: "area", label: "AREA" }, { value: "line", label: "LINE" }, { value: "volume", label: "VOLUME" }];
const cmdSymbols = COMMODITY_SYMBOLS.map((c) => c.symbol);
const slugOf = (symbol) => symbol.replace("=F", "");
// A URL may carry the Yahoo symbol itself ("/commodities/GC=F"), which must
// not become GC=F=F.
const symbolOf = (slug) => `${String(slug || "").toUpperCase().replace(/=F$/, "")}=F`;

// Room for the last date label, which is centred on the final point and was
// cut to "Oct" at the plot's right edge.
const CHART_MARGIN = { top: 8, right: 24, bottom: 0, left: 4 };

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
      // and show the rolling contract month separately. Units are upper-cased
      // here so "$/MMBtu" matches the spec's "MMBTU".
      return { ...q, ...c, unit: c.unit || "", spec, contract: contractMonth(q.longName || q.shortName || q.name) };
    }),
    [data]
  );

  const requested = params.symbol ? symbolOf(params.symbol) : null;
  const match = requested ? rows.find((r) => r.symbol === requested) : null;
  // A contract this screen does not carry says NOT FOUND. Falling back to
  // the first row would show crude oil under a URL that names another one.
  // The values below still derive from the first row; they are cheap and unused.
  const missing = Boolean(requested) && !match;
  const selected = match || rows[0];
  const symbol = selected.symbol;
  const isCents = selected.unit.startsWith("¢");
  const money = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : `${isCents ? "¢" : "$"}${fmtNum(v, d)}`);

  const { data: hist, loading: histLoading } = useHistorical(missing ? null : symbol, range);
  const chartRows = useMemo(
    () => hist.map((d) => ({ date: d.date || "", price: d.close, high: d.high, low: d.low, volume: d.volume })),
    [hist]
  );
  const returns = useMemo(() => periodReturns(hist, TRADING_DAY_OFFSETS), [hist]);
  const showYear = range === "1y" || range === "5y";
  // The day's high and low as dashed lines read up to six months; over a year
  // or more they are a few pixels apart and turn into fuzz around the close.
  const bands = type === "line" && !showYear;
  const scale = useMemo(
    () => niceTicks(bands ? chartRows.flatMap((r) => [r.price, r.high, r.low]) : chartRows.map((r) => r.price), isMobile ? 5 : 6),
    [chartRows, bands, isMobile]
  );
  const yAxis = {
    ...axisProps,
    domain: scale ? scale.domain : ["auto", "auto"],
    ticks: scale ? scale.ticks : undefined,
    width: 60,
    tickFormatter: (v) => money(v, scale ? scale.decimals : 2),
  };
  // Multi-year axes label month starts, once each; shorter ranges label days.
  const xTicks = showYear ? monthTicks(chartRows.map((r) => r.date), isMobile ? 6 : 12) : undefined;
  const xAxis = {
    ...axisProps,
    dataKey: "date",
    ticks: xTicks,
    interval: xTicks ? 0 : Math.max(1, Math.floor(chartRows.length / (isMobile ? 6 : 12))),
    tickFormatter: (v) => fmtAxisDate(v, showYear),
    minTickGap: 20,
  };
  const lull = type === "volume" && hasRollLull(hist);
  const tip = { ...tooltipProps, labelFormatter: fmtTooltipDate };

  const select = (sym) => navigate(pathFor("commodities", { symbol: slugOf(sym) }, query));

  const listColumns = [
    // Clipped so LAST and CHG always fit; the full name is in the header.
    { key: "name", label: "COMMODITY", align: "left", render: (r) => <span className="pb-eq__sym pb-clip" style={{ "--clip": "15ch" }} title={r.name}>{r.name}</span> },
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
        selectedKey={missing ? null : symbol}
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

  const detail = missing ? (
    <div className="pb-eq__detail pb-des">
      <EmptyState>CONTRACT {slugOf(requested)} NOT FOUND</EmptyState>
    </div>
  ) : (
    <div className="pb-eq__detail pb-des">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{selected.name}</span>
        <span className="pb-eq__name pb-muted">{symbol}</span>
        {selected.spec.exchange && <Tag>{selected.spec.exchange}</Tag>}
        {selected.spec.category && <Tag>{selected.spec.category}</Tag>}
        {selected.contract && <span className="pb-muted">FRONT MONTH {selected.contract}</span>}
      </header>

      <StatRow>
        <Stat label={`Last (${selected.unit})`} value={selected.price > 0 ? fmtNum(selected.price) : "—"} size="lg" />
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
            {bands && (
              <span className="pb-key">
                <span className="pb-key__item">
                  <i className="pb-key__swatch pb-key__swatch--line" style={{ color: colors.series[0] }} aria-hidden="true" />CLOSE
                </span>
                <span className="pb-key__item">
                  <i className="pb-key__swatch pb-key__swatch--dash" style={{ color: colors.series[2] }} aria-hidden="true" />DAY HI / LO
                </span>
              </span>
            )}
          </div>
          <ChartFrame height="fill" minHeight={isMobile ? 240 : 340} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? `NO HISTORY FOR ${selected.name.toUpperCase()}` : null}>
            {type === "line" ? (
              <LineChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis {...yAxis} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
                {bands && <Line dataKey="high" name="HIGH" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />}
                {bands && <Line dataKey="low" name="LOW" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" strokeWidth={1} />}
              </LineChart>
            ) : type === "volume" ? (
              <ComposedChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis yAxisId="p" {...yAxis} />
                <YAxis yAxisId="v" orientation="right" {...axisProps} width={48} tickFormatter={(v) => fmtK(v)} />
                <Tooltip {...tip} formatter={(v, n) => (n === "VOLUME" ? fmtK(v) : money(v))} />
                <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis {...yAxis} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
              </AreaChart>
            )}
          </ChartFrame>
          {lull && (
            <div className="pb-form__hint pb-muted pb-mkt__note">
              NEAR-ZERO VOLUME RUNS: FRONT MONTH IN DELIVERY, TRADING ALREADY ROLLED TO THE NEXT CONTRACT.
            </div>
          )}
        </>
      )}

      {tab === "STATS" && (
        <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <Section title="Price action" meta={selected.unit}>
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
                <RangeBar pct={yearPct} lo={fmtLevel(selected.week52Low)} hi={fmtLevel(selected.week52High)} />
              </div>
            )}
          </Section>
          <Section title="Period returns" meta="TRADING DAYS">
            <PeriodReturns
              returns={returns}
              note="OFFSETS 5 / 21 / 63 / 126 / 252 SESSIONS ON THE LOADED RANGE; A LONGER RANGE UNLOCKS LONGER PERIODS. YTD FROM LAST YEAR'S FINAL CLOSE."
            />
          </Section>
        </div>
      )}

      {tab === "SPEC" && (
        <Section title="Contract specification" meta={`${symbol} FRONT MONTH`}>
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
            CONTINUOUS FRONT-MONTH SERIES: ROLLS CAN DISTORT RETURNS NEAR EXPIRY, ESPECIALLY IN ENERGY.
            SPECS FROM EXCHANGE RULEBOOKS, NOT THE QUOTE FEED.
          </div>
        </Section>
      )}
    </div>
  );

  // A native select shows its first option when the value matches none, so a
  // missing contract gets a placeholder rather than reading as crude oil.
  const options = rows.map((r) => ({ value: r.symbol, label: `${r.name}${r.price > 0 ? ` · ${fmtNum(r.price)}` : ""}` }));

  return (
    <ListDetail
      className="pb-mkt"
      listWidth={288}
      list={list}
      detail={detail}
      mobile={{
        label: "Commodity",
        value: missing ? "" : symbol,
        onChange: select,
        options: missing ? [{ value: "", label: `${slugOf(requested)} · NOT FOUND` }, ...options] : options,
      }}
    />
  );
}
