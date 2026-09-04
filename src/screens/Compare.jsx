import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { fmt, fmtK, fmtNum, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
import { normalizeToPct, alignTimelines, winnerOf } from "../compareUtils.js";
import { normalizeSymbol } from "../lib/ticker.js";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useQuote, usePoolExtra } from "../data/quotePool.jsx";
import { useHistorical, useFinancialsWithRetry, useIsMobile } from "../data/hooks.js";
import { useNewsFeed } from "../features/newsFeed.jsx";
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

const RANGES = ["1mo", "3mo", "6mo", "1y", "ytd"];

// One metric row: both values, the label between them, the better side lit.
function Row({ label, a, b, format, higherIsBetter, suffix = "" }) {
  const toNum = (v) => {
    if (v == null) return NaN;
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v);
    if (typeof v === "object" && "raw" in v) return Number(v.raw);
    return Number(v);
  };
  const av = toNum(a);
  const bv = toNum(b);
  const winner = winnerOf(av, bv, higherIsBetter);
  const cell = (v, win) => (
    <span className={win ? "pb-cmp__win" : ""}>{!Number.isFinite(v) || v === 0 ? "—" : format(v) + suffix}</span>
  );
  return (
    <div className="pb-cmp__row">
      <span className="pb-cmp__a">{cell(av, winner === "a")}</span>
      <span className="pb-cmp__label pb-label">{label}</span>
      <span className="pb-cmp__b">{cell(bv, winner === "b")}</span>
    </div>
  );
}

function QuoteSide({ symbol }) {
  const q = useQuote(symbol);
  if (!q) return <EmptyState>NO DATA FOR {symbol}</EmptyState>;
  return (
    <>
      <div className="pb-cmp__head">
        <Ticker symbol={q.symbol} name={q.name} />
        <span className="pb-muted">{(q.name || "").slice(0, 28)}</span>
        {q.exchange && <Tag>{q.exchange}</Tag>}
      </div>
      <KVList>
        <KV k="LAST" v={fmtNum(q.price)} />
        <KV k="CHG" v={<Change value={q.changePercent} />} />
        <KV k="MKT CAP" v={q.marketCap > 0 ? fmtK(q.marketCap) : "—"} />
        <KV k="P/E" v={q.pe > 0 ? `${fmt(q.pe, 1)}x` : "—"} />
        <KV k="BETA" v={q.beta > 0 ? fmt(q.beta) : "—"} />
        <KV k="DIV YLD" v={q.dividendYield > 0 ? `${fmt(q.dividendYield)}%` : "—"} />
        <KV k="VOL" v={q.volume > 0 ? fmtK(q.volume) : "—"} />
        <KV k="52W" v={q.week52Low > 0 ? `${fmt(q.week52Low, 0)} – ${fmt(q.week52High, 0)}` : "—"} />
      </KVList>
    </>
  );
}

export default function Compare() {
  const { query } = useRoute();
  const a = (query.a || "").toUpperCase();
  const b = (query.b || "").toUpperCase();
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const [inputA, setInputA] = useState(a);
  const [inputB, setInputB] = useState(b);
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, lineProps } = useChartTheme();

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

  const apply = (e) => {
    e.preventDefault();
    const na = normalizeSymbol(inputA);
    const nb = normalizeSymbol(inputB);
    if (!na || !nb || na === nb) return;
    updateQuery({ a: na, b: nb });
  };
  const swap = () => updateQuery({ a: b || null, b: a || null });
  const clear = () => updateQuery({ a: null, b: null });
  const canApply = normalizeSymbol(inputA) && normalizeSymbol(inputB) && normalizeSymbol(inputA) !== normalizeSymbol(inputB);

  return (
    <Page>
      <Section
        mnemonic="COMP"
        title="Compare"
        meta={both ? `${a} vs ${b}` : "two equities"}
        actions={
          <>
            <Button size="sm" onClick={swap} aria-label="Swap A and B" disabled={!both}><ArrowLeftRight size={11} strokeWidth={1.5} /></Button>
            <Button size="sm" onClick={clear} aria-label="Clear" disabled={!a && !b}><X size={11} strokeWidth={1.5} /></Button>
          </>
        }
      >
        <form className="pb-cmp__form" onSubmit={apply}>
          <span className="pb-label">A</span>
          <Input value={inputA} onChange={(e) => setInputA(e.target.value)} placeholder="AAPL" aria-label="First ticker" mono />
          <span className="pb-label">VS</span>
          <Input value={inputB} onChange={(e) => setInputB(e.target.value)} placeholder="MSFT" aria-label="Second ticker" mono />
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
            <Section title={a}><QuoteSide symbol={a} /></Section>
            <Section title={b}><QuoteSide symbol={b} /></Section>
          </Grid>

          <Section
            title="Normalised price"
            meta="% from start"
            actions={<Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />}
          >
            <ChartFrame height={isMobile ? 240 : 300} loading={(loadA || loadB) && !chartRows.length} empty={!loadA && !loadB && !chartRows.length ? "NO OVERLAPPING HISTORY" : null}>
              <LineChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(v) => fmtAxisDate(v, range === "1y")} />
                <YAxis {...axisProps} width={48} tickFormatter={(v) => `${fmt(v, 0)}%`} />
                <Tooltip {...tooltipProps} labelFormatter={fmtTooltipDate} formatter={(v) => (Number.isFinite(v) ? `${fmt(v)}%` : "—")} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "inherit" }} />
                <Line dataKey="a" name={a} stroke={colors.series[0]} {...lineProps} connectNulls={false} />
                <Line dataKey="b" name={b} stroke={colors.series[1]} {...lineProps} connectNulls={false} />
              </LineChart>
            </ChartFrame>
          </Section>

          <Grid cols="1fr 1fr" colsMobile="1fr">
            <Section title="Fundamentals">
              {(finLoadA || finLoadB) && !finA && !finB ? <EmptyState>LOADING…</EmptyState> : (
                <div className="pb-cmp">
                  <Row label="GROSS MARGIN" a={finA && finA.margins.gross} b={finB && finB.margins.gross} format={(v) => fmt(v, 1)} suffix="%" higherIsBetter />
                  <Row label="OPER MARGIN" a={finA && finA.margins.operating} b={finB && finB.margins.operating} format={(v) => fmt(v, 1)} suffix="%" higherIsBetter />
                  <Row label="PROFIT MARGIN" a={finA && finA.margins.profit} b={finB && finB.margins.profit} format={(v) => fmt(v, 1)} suffix="%" higherIsBetter />
                  <Row
                    label="LATEST Q REV"
                    a={finA && finA.quarterlyRevenue.length ? finA.quarterlyRevenue[finA.quarterlyRevenue.length - 1].revenue : null}
                    b={finB && finB.quarterlyRevenue.length ? finB.quarterlyRevenue[finB.quarterlyRevenue.length - 1].revenue : null}
                    format={(v) => fmtK(v)}
                    higherIsBetter
                  />
                  <Row label="EPS (TTM)" a={quoteA && quoteA.eps} b={quoteB && quoteB.eps} format={(v) => fmt(v)} higherIsBetter />
                </div>
              )}
            </Section>
            <Section title="Ratios">
              {(finLoadA || finLoadB) && !finA && !finB ? <EmptyState>LOADING…</EmptyState> : (
                <div className="pb-cmp">
                  <Row label="P/E (TTM)" a={(finA && finA.ratios.pe) || (quoteA && quoteA.pe)} b={(finB && finB.ratios.pe) || (quoteB && quoteB.pe)} format={(v) => fmt(v, 1)} suffix="x" higherIsBetter={false} />
                  <Row label="P/S" a={finA && finA.ratios.ps} b={finB && finB.ratios.ps} format={(v) => fmt(v)} suffix="x" higherIsBetter={false} />
                  <Row label="P/B" a={finA && finA.ratios.pb} b={finB && finB.ratios.pb} format={(v) => fmt(v)} suffix="x" higherIsBetter={false} />
                  <Row label="EV/EBITDA" a={finA && finA.ratios.evEbitda} b={finB && finB.ratios.evEbitda} format={(v) => fmt(v, 1)} suffix="x" higherIsBetter={false} />
                  <Row label="ROE" a={finA && finA.ratios.roe} b={finB && finB.ratios.roe} format={(v) => fmt(v, 1)} suffix="%" higherIsBetter />
                  <Row label="DEBT / EQUITY" a={finA && finA.ratios.debtToEquity} b={finB && finB.ratios.debtToEquity} format={(v) => fmt(v)} suffix="%" higherIsBetter={false} />
                </div>
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
