import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { fmt, fmtK, fmtNum, fmtLevel, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { exchangeLabel } from "../lib/exchange.js";
import { normalizeToPct, alignTimelines, winnerOf, metricValue, statementCurrency, CROSS_CURRENCY_RATIOS, valueAxis } from "../compareUtils.js";
import { toYahooSymbol } from "../lib/ticker.js";
import { universeEntry } from "../data/universe.js";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useQuote, usePoolExtra } from "../data/quotePool.jsx";
import { useHistorical, useFinancialsWithRetry, useIsMobile } from "../data/hooks.js";
import { useNewsFeed } from "../features/newsFeed.jsx";
import { useResolvedTheme } from "../theme/useResolvedTheme.js";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Tag } from "../ui/Tag.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";
import { ChartKey } from "../ui/ChartKey.jsx";

const RANGES = ["1mo", "3mo", "6mo", "1y", "ytd"];

// One precision per kind of row, as on the Equities tabs: multiples to two
// places, percentages to one.
const multiple = (v) => `${fmt(v, 2)}x`;
const percent = (v) => `${fmt(v, 1)}%`;

// One metric row: A's value, the label, B's value, the better side lit. The
// cells sit in the columns of the grid around them, so values line up down
// the table. A placeholder zero from the proxy prints "—" like any other
// missing value. `unitA`/`unitB` label a statement figure with its currency;
// figures in two different currencies are shown but never ranked.
// `rank={false}` for size figures (revenue, EPS): a bigger company or a
// smaller share count is not "better", so neither side is marked.
function Row({ label, a, b, format, higherIsBetter, rank = true, unitA = "", unitB = "" }) {
  const av = metricValue(a);
  const bv = metricValue(b);
  const winner = rank && unitA === unitB ? winnerOf(av, bv, higherIsBetter) : null;
  const cell = (v, unit, win, side) => (
    <span className={`pb-cmp__${side}${win ? " pb-cmp__win" : ""}`}>{v == null ? "—" : format(v) + unit}</span>
  );
  return (
    <div className="pb-cmp__row">
      {cell(av, unitA, winner === "a", "a")}
      <span className="pb-cmp__label pb-label">{label}</span>
      {cell(bv, unitB, winner === "b", "b")}
    </div>
  );
}

// The tickers over their columns, so a phone, where the two sections stack,
// still says which side is which.
function HeadRow({ a, b }) {
  return (
    <div className="pb-cmp__row pb-cmp__row--head">
      <span className="pb-cmp__a">{a}</span>
      <span className="pb-cmp__label" aria-hidden="true" />
      <span className="pb-cmp__b">{b}</span>
    </div>
  );
}

function QuoteSide({ symbol }) {
  const q = useQuote(symbol);
  if (!q) return <EmptyState>NO DATA FOR {symbol}</EmptyState>;
  // Yahoo's short name is cut at 31 characters ("Taiwan Semiconductor
  // Manufactur"); the universe has the full one.
  const name = (universeEntry(symbol) || {}).name || q.name || "";
  return (
    <>
      <div className="pb-cmp__head">
        <Ticker symbol={q.symbol} name={name} />
        <span className="pb-muted pb-cmp__name" title={name}>{name}</span>
        {q.exchange && <Tag>{exchangeLabel(q.exchange)}</Tag>}
      </div>
      <KVList>
        <KV k="LAST" v={fmtNum(q.price)} />
        <KV k="CHG" v={<Change value={q.changePercent} />} />
        <KV k="MKT CAP" v={q.marketCap > 0 ? fmtK(q.marketCap) : "—"} />
        <KV k="P/E" v={q.pe > 0 ? multiple(q.pe) : "—"} />
        <KV k="BETA" v={q.beta > 0 ? fmt(q.beta) : "—"} />
        <KV k="DIV YLD" v={q.dividendYield > 0 ? `${fmt(q.dividendYield)}%` : "—"} />
        <KV k="VOL" v={q.volume > 0 ? fmtK(q.volume) : "—"} />
        <KV k="52W" v={q.week52Low > 0 && q.week52High > 0 ? `${fmtLevel(q.week52Low)} – ${fmtLevel(q.week52High)}` : "—"} />
      </KVList>
    </>
  );
}

export default function Compare() {
  const { query } = useRoute();
  // Normalised here as well as on submit, so an old link with BRK.B in it
  // still asks the proxy for BRK-B.
  const a = toYahooSymbol(query.a) || "";
  const b = toYahooSymbol(query.b) || "";
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const [inputA, setInputA] = useState(a);
  const [inputB, setInputB] = useState(b);
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, lineProps } = useChartTheme();
  // Ticks at 10px; the muted grey washes out on the light paper.
  const light = useResolvedTheme() === "light";
  const axis = { ...axisProps, tick: { ...axisProps.tick, fill: light ? colors.dim : colors.muted } };

  useEffect(() => { setInputA(a); setInputB(b); }, [a, b]);

  usePoolExtra(a || null);
  usePoolExtra(b || null);
  const quoteA = useQuote(a);
  const quoteB = useQuote(b);
  const { data: histA, loading: loadA } = useHistorical(a, range);
  const { data: histB, loading: loadB } = useHistorical(b, range);
  const { data: finA, loading: finLoadA } = useFinancialsWithRetry(a);
  const { data: finB, loading: finLoadB } = useFinancialsWithRetry(b);
  const { news } = useNewsFeed();

  const chartRows = useMemo(() => alignTimelines(normalizeToPct(histA), normalizeToPct(histB)), [histA, histB]);
  const both = Boolean(a && b);
  // One precision for every tick, from the range on screen: a pair that moved
  // 2% needs decimals, one that moved 40% does not.
  const yAxis = useMemo(() => valueAxis(chartRows.flatMap((r) => [r.a, r.b]), "%"), [chartRows]);

  const na = toYahooSymbol(inputA);
  const nb = toYahooSymbol(inputB);
  const canApply = Boolean(na && nb && na !== nb);
  const apply = (e) => {
    e.preventDefault();
    if (canApply) updateQuery({ a: na, b: nb });
  };
  const swap = () => updateQuery({ a: b || null, b: a || null });
  const clear = () => updateQuery({ a: null, b: null });

  // Statement figures carry their currency. A ratio that divides a dollar
  // price by a home-currency figure is dropped, with a note saying why.
  const curA = statementCurrency(finA, quoteA);
  const curB = statementCurrency(finB, quoteB);
  const unitOf = (fin, quote) => {
    const c = (fin && fin.financialCurrency) || (quote && quote.currency) || "";
    return c ? ` ${c}` : "";
  };
  const ratio = (fin, cur, key) => (fin && !(cur && CROSS_CURRENCY_RATIOS.includes(key)) ? fin.ratios[key] : null);
  const lastRev = (fin) => (fin && fin.quarterlyRevenue.length ? fin.quarterlyRevenue[fin.quarterlyRevenue.length - 1].revenue : null);
  const mixedNotes = [[a, curA, quoteA], [b, curB, quoteB]]
    .filter(([, cur]) => cur)
    .map(([sym, cur, q]) => `— ${sym} P/S, P/B, EV/EBITDA: STATEMENTS IN ${cur}, PRICE IN ${q.currency}`);

  return (
    <Page>
      <Section
        mnemonic="COMP"
        title="Side by side"
        meta={both ? `${a} VS ${b}` : "PICK TWO TICKERS"}
        actions={
          <>
            <Button size="sm" onClick={swap} aria-label="Swap A and B" disabled={!both}><ArrowLeftRight size={11} strokeWidth={1.5} /></Button>
            <Button size="sm" onClick={clear} aria-label="Clear" disabled={!a && !b}><X size={11} strokeWidth={1.5} /></Button>
          </>
        }
      >
        <form className="pb-cmp__form" onSubmit={apply}>
          <span className="pb-label">A</span>
          <Input value={inputA} onChange={(e) => setInputA(e.target.value)} placeholder="TICKER" aria-label="First ticker" mono />
          <span className="pb-label">VS</span>
          <Input value={inputB} onChange={(e) => setInputB(e.target.value)} placeholder="TICKER" aria-label="Second ticker" mono />
          <Button type="submit" variant="primary" disabled={!canApply}>COMPARE</Button>
        </form>
      </Section>

      {!both ? (
        <Section title="No pair selected">
          <EmptyState>ENTER TWO TICKERS ABOVE</EmptyState>
        </Section>
      ) : (
        <>
          <Grid cols="1fr 1fr" colsMobile="1fr">
            <Section title="Side A"><QuoteSide symbol={a} /></Section>
            <Section title="Side B"><QuoteSide symbol={b} /></Section>
          </Grid>

          <Section
            title="Normalised price"
            className="pb-cmp__chart"
            actions={<Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />}
          >
            <div className="pb-chartbar">
              <ChartKey items={[{ label: a, color: colors.series[0], line: true }, { label: b, color: colors.series[1], line: true }]} />
              <span className="pb-label">% CHG FROM START</span>
            </div>
            <ChartFrame height={isMobile ? 240 : 300} loading={(loadA || loadB) && !chartRows.length} empty={!loadA && !loadB && !chartRows.length ? "NO OVERLAPPING HISTORY" : null}>
              <LineChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(v) => fmtAxisDate(v, range === "1y")} />
                <YAxis {...axis} domain={yAxis.domain} ticks={yAxis.ticks} width={yAxis.width} tickFormatter={yAxis.format} />
                <Tooltip {...tooltipProps} labelFormatter={fmtTooltipDate} formatter={(v) => (Number.isFinite(v) ? `${fmt(v)}%` : "—")} />
                <Line dataKey="a" name={a} stroke={colors.series[0]} {...lineProps} connectNulls={false} />
                <Line dataKey="b" name={b} stroke={colors.series[1]} {...lineProps} connectNulls={false} />
              </LineChart>
            </ChartFrame>
          </Section>

          <Grid cols="1fr 1fr" colsMobile="1fr">
            <Section title="Fundamentals">
              {(finLoadA || finLoadB) && !finA && !finB ? <EmptyState>LOADING…</EmptyState> : (
                <div className="pb-cmp">
                  <HeadRow a={a} b={b} />
                  <Row label="GROSS MARGIN" a={finA && finA.margins.gross} b={finB && finB.margins.gross} format={percent} higherIsBetter />
                  <Row label="OPER MARGIN" a={finA && finA.margins.operating} b={finB && finB.margins.operating} format={percent} higherIsBetter />
                  <Row label="PROFIT MARGIN" a={finA && finA.margins.profit} b={finB && finB.margins.profit} format={percent} higherIsBetter />
                  <Row label="LATEST Q REV" a={lastRev(finA)} b={lastRev(finB)} format={fmtK} unitA={unitOf(finA, quoteA)} unitB={unitOf(finB, quoteB)} rank={false} />
                  <Row label="EPS (TTM)" a={quoteA && quoteA.eps} b={quoteB && quoteB.eps} format={(v) => fmt(v)} rank={false} />
                </div>
              )}
            </Section>
            <Section title="Ratios">
              {(finLoadA || finLoadB) && !finA && !finB ? <EmptyState>LOADING…</EmptyState> : (
                <>
                  <div className="pb-cmp">
                    <HeadRow a={a} b={b} />
                    {/* The quote's P/E is Yahoo's trailingPE. The financials P/E falls back to
                        forward P/E when trailing is missing, which is usually because earnings are
                        negative, so it would put a loss-maker's forward multiple under a TTM label. */}
                    <Row label="P/E (TTM)" a={quoteA && quoteA.pe} b={quoteB && quoteB.pe} format={multiple} higherIsBetter={false} />
                    <Row label="P/S" a={ratio(finA, curA, "ps")} b={ratio(finB, curB, "ps")} format={multiple} higherIsBetter={false} />
                    <Row label="P/B" a={ratio(finA, curA, "pb")} b={ratio(finB, curB, "pb")} format={multiple} higherIsBetter={false} />
                    <Row label="EV/EBITDA" a={ratio(finA, curA, "evEbitda")} b={ratio(finB, curB, "evEbitda")} format={multiple} higherIsBetter={false} />
                    <Row label="ROE" a={ratio(finA, curA, "roe")} b={ratio(finB, curB, "roe")} format={percent} higherIsBetter />
                    <Row label="DEBT / EQUITY" a={ratio(finA, curA, "debtToEquity")} b={ratio(finB, curB, "debtToEquity")} format={percent} higherIsBetter={false} />
                  </div>
                  {mixedNotes.map((note) => <p key={note} className="pb-cmp__note pb-muted">{note}</p>)}
                </>
              )}
            </Section>
          </Grid>

          <Grid cols="1fr 1fr" colsMobile="1fr">
            {[a, b].map((sym) => {
              const items = (news || []).filter((n) => (n.relatedSymbol || "").toUpperCase() === sym).slice(0, 3);
              return (
                <Section key={sym} title={`${sym} headlines`} flush>
                  {!items.length ? <EmptyState>NO HEADLINES IN THE FEED</EmptyState> : (
                    <ol className="pb-newslist">
                      {items.map((n, i) => (
                        <li key={n.link || n.title} className="pb-newslist__row">
                          <span className="pb-newslist__num pb-muted">{i + 1})</span>
                          <a className="pb-newslist__body" href={n.link} target="_blank" rel="noopener noreferrer">
                            <span className="pb-newslist__meta pb-muted">{n.publisher || "—"}</span>
                            <span className="pb-newslist__title">{n.title}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
              );
            })}
          </Grid>
        </>
      )}
    </Page>
  );
}
