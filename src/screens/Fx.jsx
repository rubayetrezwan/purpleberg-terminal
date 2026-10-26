import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { FX_SYMBOLS } from "../config.js";
import { fmt, fmtNum, fmtPct, fmtAxisDate, fmtTooltipDate, fmtDateTable } from "../lib/format.js";
import { niceTicks, monthTicks } from "../lib/axis.js";
import { pipSize, rateDecimals, amountDecimals, parseAmount, fxChange } from "../lib/fx.js";
import { useRoute, updateQuery, navigate, pathFor } from "../router/index.jsx";
import { useQuotes, useHistorical, useIsMobile } from "../data/hooks.js";
import { api } from "../data/api.js";
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
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

const RANGES = ["1mo", "3mo", "6mo", "1y"];
const fxSymbols = FX_SYMBOLS.map((f) => f.symbol);
const slugOf = (symbol) => symbol.replace("=X", "");
// A URL may carry the Yahoo symbol itself ("/fx/USDJPY=X"), which must not
// become USDJPY=X=X.
const symbolOf = (slug) => `${String(slug || "").toUpperCase().replace(/=X$/, "")}=X`;

// The proxy derives these crosses by multiplying two Yahoo pairs, so their
// high and low are the product of the legs' extremes and overstate the range.
const DERIVED = new Set(["AUDBDT=X", "GBPBDT=X", "EURBDT=X"]);

// Room for the last date label, which is centred on the final point and was
// cut to "Oct" at the plot's right edge.
const CHART_MARGIN = { top: 8, right: 24, bottom: 0, left: 4 };

// The last few daily closes of every pair. Indicative quotes are measured
// against them, and a live change is checked against them (Yahoo's previous
// close for thin pairs such as USD/BDT can be wrong). Daily closes change
// once a day, so they are refreshed only every half hour.
function useDailyCloses(symbols) {
  const [closes, setCloses] = useState({});
  const key = symbols.join(",");
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    const load = () => Promise.all(
      key.split(",").map((s) => api.historical(s, "1mo").then((rows) => [s, rows], () => [s, null]))
    ).then((pairs) => {
      if (!live) return;
      setCloses((prev) => {
        const next = { ...prev };
        for (const [s, rows] of pairs) if (Array.isArray(rows) && rows.length) next[s] = rows.slice(-5);
        return next;
      });
    });
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => { live = false; clearInterval(iv); };
  }, [key]);
  return closes;
}

export default function Fx() {
  const { params, query } = useRoute();
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const { data, loading, updatedAt, intervalMs } = useQuotes(fxSymbols, 10000);
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, areaProps } = useChartTheme();
  const [amount, setAmount] = useState("1000");

  const quotes = useMemo(() => new Map(data.map((d) => [d.symbol, d])), [data]);
  const closes = useDailyCloses(fxSymbols);

  const rows = useMemo(
    () => FX_SYMBOLS.map((f) => {
      const q = quotes.get(f.symbol);
      const move = fxChange(q, closes[f.symbol]);
      return {
        ...f,
        price: q ? q.price : 0,
        open: q ? q.open : 0,
        change: move.change,
        changePercent: move.changePercent,
        indicative: move.indicative,
        basis: move.basis,
        high: q ? q.high : 0,
        low: q ? q.low : 0,
        fallback: Boolean(q && q.exchange === "FX"),
      };
    }),
    [quotes, closes]
  );

  const requested = params.pair ? symbolOf(params.pair) : null;
  const match = requested ? rows.find((r) => r.symbol === requested) : null;
  // A pair this screen does not carry says NOT FOUND. Falling back to the
  // first row would show EUR/USD under a URL that names another pair. The
  // values below still derive from the first row; they are cheap and unused.
  const missing = Boolean(requested) && !match;
  const selected = match || rows[0];
  const symbol = selected.symbol;
  const dp = rateDecimals(selected.price);
  const pip = pipSize(selected.price);
  const derived = DERIVED.has(symbol);
  // An empty range (high equal to low, or missing) is not a quiet day of zero
  // pips; it is a feed with no session data, and reads as a dash.
  const hasRange = selected.high > 0 && selected.low > 0 && selected.high > selected.low;
  const dayRange = hasRange ? selected.high - selected.low : null;
  const pips = dayRange == null ? null : Math.round(dayRange / pip);
  const [base, quote] = selected.pair.split("/");

  const { data: hist, loading: histLoading } = useHistorical(missing ? null : symbol, range);
  const chartRows = useMemo(() => hist.map((d) => ({ date: d.date || "", price: d.close })), [hist]);
  const scale = useMemo(() => niceTicks(chartRows.map((r) => r.price), isMobile ? 5 : 6), [chartRows, isMobile]);
  // Ticks keep FX quoting precision (four places for majors) even when the
  // step itself needs fewer.
  const yDecimals = scale ? Math.max(scale.decimals, dp) : dp;
  const xTicks = range === "1y" ? monthTicks(chartRows.map((r) => r.date), isMobile ? 6 : 12) : undefined;
  const qty = parseAmount(amount);
  const converted = selected.price > 0 && qty != null ? qty * selected.price : null;

  const select = (sym) => navigate(pathFor("fx", { pair: slugOf(sym) }, query));

  const listColumns = [
    { key: "pair", label: "PAIR", align: "left", render: (r) => <span className="pb-eq__sym">{r.pair}</span> },
    { key: "price", label: "RATE", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmt(v, rateDecimals(v))} /> : "—") },
    { key: "changePercent", label: "CHG", render: (r) => <Change value={r.changePercent} /> },
  ];

  const list = (
    <Section title="FX rates" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      <DataTable
        label="Currency pairs"
        columns={listColumns}
        rows={rows}
        rowKey={(r) => r.symbol}
        selectedKey={missing ? null : symbol}
        numbered
        navigable
        loading={loading && !data.length}
        onRowClick={(r) => select(r.symbol)}
        empty="NO RATES"
      />
    </Section>
  );

  const chg = selected.changePercent;
  const basisDate = selected.basis ? fmtDateTable(selected.basis.date) : "";

  const detail = missing ? (
    <div className="pb-eq__detail pb-des">
      <EmptyState>PAIR {slugOf(requested)} NOT FOUND</EmptyState>
    </div>
  ) : (
    <div className="pb-eq__detail pb-des">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{selected.pair}</span>
        <span className="pb-eq__name pb-muted">{symbol}</span>
        {selected.indicative && <Tag tone="warn" title="Market closed or no range today: change is against the last daily close">INDICATIVE</Tag>}
        {selected.fallback && <Tag tone="warn" title="Daily fallback rate from open.er-api.com">DAILY FALLBACK</Tag>}
        {derived && <Tag title="Computed from two Yahoo pairs">DERIVED</Tag>}
      </header>

      <StatRow>
        <Stat label="Rate" value={selected.price > 0 ? fmt(selected.price, dp) : "—"} size="lg" />
        <Stat
          label="Chg"
          value={chg == null ? "—" : fmtPct(chg)}
          tone={chg == null ? undefined : chg >= 0 ? "up" : "down"}
          sub={selected.indicative ? (basisDate ? `VS ${basisDate}` : "VS LAST CLOSE") : null}
        />
        <Stat label="Day range" value={pips == null ? "—" : `${pips} PIPS`} />
        <Stat label="Hi" value={hasRange ? fmt(selected.high, dp) : "—"} />
        <Stat label="Lo" value={hasRange ? fmt(selected.low, dp) : "—"} />
      </StatRow>

      <Section
        className="pb-fx__hist"
        title={`${selected.pair} history`}
        actions={<Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />}
      >
        <ChartFrame height="fill" minHeight={isMobile ? 220 : 300} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? "NO HISTORY" : null}>
          <AreaChart data={chartRows} margin={CHART_MARGIN}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} ticks={xTicks} interval={xTicks ? 0 : "preserveEnd"} minTickGap={30} tickFormatter={(v) => fmtAxisDate(v, range === "1y")} />
            <YAxis
              {...axisProps}
              domain={scale ? scale.domain : ["auto", "auto"]}
              ticks={scale ? scale.ticks : undefined}
              width={64}
              tickFormatter={(v) => fmt(v, yDecimals)}
            />
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
              {/* A text field with a decimal keypad: a number input draws
                  spinners and silently turns "1,000" into an empty value. */}
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={`Amount in ${base}`}
                mono
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="pb-fx__out">
              <span className="pb-label">{quote}</span>
              <span className="pb-fx__val">{converted == null ? "—" : fmtNum(converted, amountDecimals(quote))}</span>
            </div>
          </div>
          <div className="pb-form__hint pb-muted">
            {selected.price > 0 ? `1 ${base} = ${fmt(selected.price, dp)} ${quote}` : "RATE UNAVAILABLE"}
          </div>
        </Section>
        <Section title="Session">
          <KVList>
            <KV k="OPEN" v={hasRange && selected.open > 0 ? fmt(selected.open, dp) : "—"} />
            {selected.basis && <KV k="LAST CLOSE" v={`${fmt(selected.basis.close, dp)} · ${basisDate}`} />}
            <KV k="CHG ABS" v={selected.change == null ? "—" : fmt(selected.change, dp + 1)} />
            <KV k="DAY RANGE" v={dayRange == null ? "—" : `${fmt(dayRange, dp + 1)} · ${pips} PIPS`} />
            <KV k="PIP SIZE" v={fmt(pip, dp)} />
          </KVList>
          <div className="pb-form__hint pb-muted">
            NO BID/ASK FOR SPOT FX: DAY RANGE IN PIPS STANDS IN FOR THE SPREAD. DAILY FALLBACK = KEYLESS DAILY FEED.
            {selected.indicative ? " INDICATIVE = MARKET CLOSED OR NO RANGE TODAY; CHG IS AGAINST THE LAST DAILY CLOSE." : ""}
            {derived ? " DERIVED CROSS: HI/LO MULTIPLY THE LEGS' EXTREMES AND OVERSTATE THE RANGE." : ""}
          </div>
        </Section>
      </div>
    </div>
  );

  // A native select shows its first option when the value matches none, so a
  // missing pair gets a placeholder rather than reading as EUR/USD.
  const options = rows.map((r) => ({ value: r.symbol, label: `${r.pair}${r.price > 0 ? ` · ${fmt(r.price, rateDecimals(r.price))}` : ""}` }));

  return (
    <ListDetail
      className="pb-mkt"
      listWidth={212}
      list={list}
      detail={detail}
      mobile={{
        label: "Currency pair",
        value: missing ? "" : symbol,
        onChange: select,
        options: missing ? [{ value: "", label: `${slugOf(requested)} · NOT FOUND` }, ...options] : options,
      }}
    />
  );
}
