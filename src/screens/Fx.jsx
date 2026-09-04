import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { FX_SYMBOLS } from "../config.js";
import { fmt, fmtNum, fmtPct, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { useRoute, updateQuery, navigate, pathFor } from "../router/index.jsx";
import { useQuotes, useHistorical, useIsMobile } from "../data/hooks.js";
import { ListDetail } from "../ui/ListDetail.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { Stat, StatRow } from "../ui/Stat.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Input } from "../ui/Input.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

const RANGES = ["1mo", "3mo", "6mo", "1y"];
const fxSymbols = FX_SYMBOLS.map((f) => f.symbol);
const slugOf = (symbol) => symbol.replace("=X", "");
const symbolOf = (slug) => `${String(slug || "").toUpperCase()}=X`;

// Pip size follows the quote's magnitude, not the currency code: pairs quoted
// in the tens or hundreds (JPY, BDT, INR) move in 0.01, majors in 0.0001.
const bigQuote = (price) => Number(price) >= 20;
const pipSize = (price) => (bigQuote(price) ? 0.01 : 0.0001);
const decimalsFor = (price) => (bigQuote(price) ? 2 : 4);

// The proxy derives these crosses by multiplying two Yahoo pairs, so their
// high and low are the product of the legs' extremes and overstate the range.
const DERIVED = new Set(["AUDBDT=X", "GBPBDT=X", "EURBDT=X"]);

export default function Fx() {
  const { params, query } = useRoute();
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const { data, loading, updatedAt, intervalMs } = useQuotes(fxSymbols, 10000);
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, areaProps } = useChartTheme();
  const [amount, setAmount] = useState("1000");

  const rows = useMemo(
    () => FX_SYMBOLS.map((f) => {
      const q = data.find((d) => d.symbol === f.symbol);
      return {
        ...f,
        price: q ? q.price : 0,
        change: q ? q.change : null,
        changePercent: q ? q.changePercent : null,
        high: q ? q.high : 0,
        low: q ? q.low : 0,
        fallback: Boolean(q && q.exchange === "FX"),
      };
    }),
    [data]
  );

  const requested = params.pair ? symbolOf(params.pair) : null;
  const selected = rows.find((r) => r.symbol === requested) || rows[0];
  const symbol = selected.symbol;
  const dp = decimalsFor(selected.price);
  const pip = pipSize(selected.price);
  const derived = DERIVED.has(symbol);
  const dayRange = selected.high > 0 && selected.low > 0 ? selected.high - selected.low : null;
  const pips = dayRange == null ? null : Math.round(dayRange / pip);
  const [base, quote] = selected.pair.split("/");

  const { data: hist, loading: histLoading } = useHistorical(symbol, range);
  const chartRows = useMemo(() => hist.map((d) => ({ date: d.date || "", price: d.close })), [hist]);
  const converted = selected.price > 0 ? parseFloat(amount || 0) * selected.price : null;

  const select = (sym) => navigate(pathFor("fx", { pair: slugOf(sym) }, query));

  const listColumns = [
    { key: "pair", label: "PAIR", align: "left", render: (r) => <span className="pb-eq__sym">{r.pair}</span> },
    { key: "price", label: "RATE", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmt(v, decimalsFor(v))} /> : "—") },
    { key: "changePercent", label: "CHG", render: (r) => <Change value={r.changePercent} /> },
  ];

  const list = (
    <Section title="FX rates" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      <DataTable
        label="Currency pairs"
        columns={listColumns}
        rows={rows}
        rowKey={(r) => r.symbol}
        selectedKey={symbol}
        numbered
        navigable
        loading={loading && !data.length}
        onRowClick={(r) => select(r.symbol)}
        empty="NO RATES"
      />
    </Section>
  );

  const detail = (
    <div className="pb-eq__detail">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{selected.pair}</span>
        <span className="pb-eq__name pb-muted">{symbol}</span>
        {selected.fallback && <Tag tone="warn" title="Daily fallback rate from open.er-api.com">DAILY FALLBACK</Tag>}
        {derived && <Tag title="Computed from two Yahoo pairs">DERIVED</Tag>}
      </header>

      <StatRow>
        <Stat label="Rate" value={selected.price > 0 ? fmt(selected.price, dp) : "—"} size="lg" />
        <Stat label="Chg" value={selected.changePercent == null ? "—" : fmtPct(selected.changePercent)} tone={selected.changePercent >= 0 ? "up" : "down"} />
        <Stat label="Day range" value={pips == null ? "—" : `${pips} pips`} />
        <Stat label="Hi" value={selected.high > 0 ? fmt(selected.high, dp) : "—"} />
        <Stat label="Lo" value={selected.low > 0 ? fmt(selected.low, dp) : "—"} />
      </StatRow>

      <Section
        title={`${selected.pair} history`}
        actions={<Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />}
      >
        <ChartFrame height={isMobile ? 220 : 300} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? "NO HISTORY" : null}>
          <AreaChart data={chartRows}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} minTickGap={30} tickFormatter={(v) => fmtAxisDate(v, range === "1y")} />
            <YAxis {...axisProps} domain={["auto", "auto"]} width={64} tickFormatter={(v) => fmt(v, dp)} />
            <Tooltip {...tooltipProps} labelFormatter={fmtTooltipDate} formatter={(v) => fmt(v, dp)} />
            <Area dataKey="price" name="RATE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
          </AreaChart>
        </ChartFrame>
      </Section>

      <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <Section title="Converter">
          <div className="pb-fx__calc">
            <label className="pb-scr__field">
              <span className="pb-label">{base}</span>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Amount in ${base}`} mono type="number" />
            </label>
            <div className="pb-fx__out">
              <span className="pb-label">{quote}</span>
              <span className="pb-fx__val">{converted == null ? "—" : fmtNum(converted, dp)}</span>
            </div>
          </div>
          <div className="pb-form__hint pb-muted">
            {selected.price > 0 ? `1 ${base} = ${fmt(selected.price, dp)} ${quote}` : "Rate unavailable"}
          </div>
        </Section>
        <Section title="Session">
          <KVList>
            <KV k="OPEN" v={selected.price > 0 ? fmt(selected.price, dp) : "—"} />
            <KV k="CHG ABS" v={selected.change == null ? "—" : fmt(selected.change, dp + 1)} />
            <KV k="DAY RANGE" v={dayRange == null ? "—" : `${fmt(dayRange, dp + 1)} (${pips} pips)`} />
            <KV k="PIP SIZE" v={fmt(pip, 4)} />
          </KVList>
          <div className="pb-form__hint pb-muted">
            Yahoo does not publish bid or ask for spot FX, so the day range in pips is shown
            instead of a spread. Rates marked DAILY FALLBACK come from a keyless daily feed.
            {derived ? " This cross is derived from two pairs, so its high and low are the product of the legs' extremes and overstate the range." : ""}
          </div>
        </Section>
      </div>
    </div>
  );

  return (
    <ListDetail
      listWidth={200}
      list={list}
      detail={detail}
      mobile={{
        label: "Currency pair",
        value: symbol,
        onChange: select,
        options: rows.map((r) => ({ value: r.symbol, label: `${r.pair}${r.price > 0 ? ` · ${fmt(r.price, decimalsFor(r.price))}` : ""}` })),
      }}
    />
  );
}
