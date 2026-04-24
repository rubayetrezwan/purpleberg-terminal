import { useState, useMemo } from "react";
import { GitCompare, ArrowLeftRight, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useColors } from "../ThemeContext";
import { useIsMobile, useQuotes, useHistorical, useFinancialsWithRetry } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, LoadingSpinner } from "../shared";
import { fmt, fmtK } from "../config";
import { normalizeToPct, alignTimelines, winnerOf } from "../compareUtils";

function CompareRow({ label, aVal, bVal, format, higherIsBetter, suffix = "", COLORS }) {
  const winner = winnerOf(aVal, bVal, higherIsBetter);
  const cell = (val, highlighted) => (
    <span style={{
      fontFamily: "'JetBrains Mono',monospace",
      color: highlighted ? COLORS.green : COLORS.text,
      fontWeight: highlighted ? 700 : 500,
    }}>
      {val == null || val === 0 || Number.isNaN(val) ? "—" : format(val) + suffix}
    </span>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${COLORS.border}22`, fontSize: 11 }}>
      <div style={{ textAlign: "right" }}>{cell(aVal, winner === "a")}</div>
      <div style={{ color: COLORS.textMuted, fontSize: 10, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ textAlign: "left" }}>{cell(bVal, winner === "b")}</div>
    </div>
  );
}

function QuoteSide({ quote, label, COLORS }) {
  if (!quote) return (
    <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
      No data for {label}.
    </div>
  );
  const rows = [
    { l: "Price", v: <span style={{ fontWeight: 700, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(quote.price)}</span> },
    { l: "Change", v: <ChgVal val={quote.change} /> },
    { l: "Change %", v: <ChgVal val={quote.changePercent} /> },
    { l: "Market Cap", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: COLORS.text }}>{quote.marketCap > 0 ? fmtK(quote.marketCap) : "—"}</span> },
    { l: "P/E (TTM)", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: COLORS.text }}>{quote.pe > 0 ? fmt(quote.pe, 1) : "—"}</span> },
    { l: "Beta", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: quote.beta > 1.5 ? COLORS.red : quote.beta < 0.8 ? COLORS.green : COLORS.text }}>{quote.beta ? fmt(quote.beta) : "—"}</span> },
    { l: "Div Yield", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: quote.dividendYield > 0 ? COLORS.green : COLORS.textMuted }}>{quote.dividendYield > 0 ? fmt(quote.dividendYield) + "%" : "—"}</span> },
    { l: "Volume", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim }}>{quote.volume > 0 ? fmtK(quote.volume) : "—"}</span> },
    { l: "52W Range", v: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim, fontSize: 10 }}>{quote.week52Low && quote.week52High ? `${fmt(quote.week52Low)} – ${fmt(quote.week52High)}` : "—"}</span> },
  ];
  return (
    <div style={{ padding: "8px 12px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.purpleLight, letterSpacing: 1, marginBottom: 2 }}>
        {quote.symbol}
      </div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>
        {(quote.name || "").slice(0, 40)} · {quote.exchange || "—"}
      </div>
      {rows.map((r) => (
        <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${COLORS.border}22`, fontSize: 11 }}>
          <span style={{ color: COLORS.textMuted }}>{r.l}</span>
          {r.v}
        </div>
      ))}
    </div>
  );
}

// COMPARE screen — side-by-side view of two tickers.
// v1 design: two text inputs → "Compare" button applies them to `liveA`/`liveB`
// (separate from input state so polling doesn't fire on every keystroke).
// All data fetches are driven by `liveA` / `liveB`. Inputs start as "" so nothing
// fetches on mount — the user picks two tickers first.
export default function CompareStocks({ allStockQuotes = [], news = [] }) {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);

  // Pending input state (what's in the boxes)
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  // Applied state (what's actually being fetched/displayed)
  const [liveA, setLiveA] = useState("");
  const [liveB, setLiveB] = useState("");

  const apply = () => {
    setLiveA(inputA.trim().toUpperCase());
    setLiveB(inputB.trim().toUpperCase());
  };

  const swap = () => {
    setInputA(inputB);
    setInputB(inputA);
    setLiveA(liveB);
    setLiveB(liveA);
  };

  const clear = () => {
    setInputA("");
    setInputB("");
    setLiveA("");
    setLiveB("");
  };

  const quoteSymbols = useMemo(() => {
    const arr = [];
    if (liveA) arr.push(liveA);
    if (liveB) arr.push(liveB);
    return arr;
  }, [liveA, liveB]);
  const { data: quotes, loading: quotesLoading } = useQuotes(quoteSymbols, 15000);
  const quoteA = quotes.find((q) => q.symbol === liveA) || null;
  const quoteB = quotes.find((q) => q.symbol === liveB) || null;

  const [range, setRange] = useState("3mo");
  const { data: histA, loading: loadA } = useHistorical(liveA, range);
  const { data: histB, loading: loadB } = useHistorical(liveB, range);

  const chartData = useMemo(() => {
    return alignTimelines(normalizeToPct(histA), normalizeToPct(histB));
  }, [histA, histB]);

  const { data: finA, loading: finLoadA } = useFinancialsWithRetry(liveA);
  const { data: finB, loading: finLoadB } = useFinancialsWithRetry(liveB);

  const canCompare = inputA.trim() && inputB.trim() && inputA.trim().toUpperCase() !== inputB.trim().toUpperCase();

  const inputStyle = {
    flex: 1, minWidth: 0,
    background: COLORS.bgInput, border: `1px solid ${COLORS.border}`,
    color: COLORS.text, borderRadius: 3,
    padding: "6px 8px", fontSize: 12, outline: "none",
    transition: "border-color 100ms",
    fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1,
    textTransform: "uppercase",
  };

  const btnStyle = (disabled) => ({
    background: disabled ? COLORS.bgInput : COLORS.purple,
    color: disabled ? COLORS.textMuted : COLORS.white,
    border: "none", borderRadius: 3,
    padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ padding: isMobile ? 8 : 12 }}>
      <Panel>
        <PanelHeader
          icon={<GitCompare size={14} color={COLORS.purple} />}
          title="COMPARE STOCKS"
          subtitle="Side-by-side comparison of two equities"
          right={liveA && liveB ? <Badge color={COLORS.green}>{liveA} vs {liveB}</Badge> : null}
        />
        <div
          style={{
            padding: "10px 12px",
            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>A</span>
          <input
            aria-label="First ticker"
            value={inputA} onChange={(e) => setInputA(e.target.value)}
            placeholder="AAPL"
            onKeyDown={(e) => { if (e.key === "Enter" && canCompare) apply(); }}
            onFocus={(e) => { e.currentTarget.style.borderColor = COLORS.purple; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = COLORS.border; }}
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>vs</span>
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>B</span>
          <input
            aria-label="Second ticker"
            value={inputB} onChange={(e) => setInputB(e.target.value)}
            placeholder="MSFT"
            onKeyDown={(e) => { if (e.key === "Enter" && canCompare) apply(); }}
            onFocus={(e) => { e.currentTarget.style.borderColor = COLORS.purple; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = COLORS.border; }}
            style={inputStyle}
          />
          <button onClick={apply} disabled={!canCompare} style={btnStyle(!canCompare)}>
            Compare
          </button>
          <button onClick={swap} aria-label="Swap A and B" title="Swap A/B"
            style={{ ...btnStyle(false), background: COLORS.bgInput, color: COLORS.text, padding: "6px 8px" }}>
            <ArrowLeftRight size={12} />
          </button>
          <button onClick={clear} aria-label="Clear tickers" title="Clear"
            style={{ ...btnStyle(false), background: COLORS.bgInput, color: COLORS.text, padding: "6px 8px" }}>
            <X size={12} />
          </button>
        </div>

        {/* Empty state / future panels go here */}
        {(!liveA || !liveB) && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
            Enter two tickers above and press <strong>Compare</strong> to begin.
          </div>
        )}
        {liveA && liveB && (
          <>
            {quotesLoading && !quoteA && !quoteB ? (
              <LoadingSpinner text={`Loading quotes for ${liveA} and ${liveB}...`} />
            ) : (
              <section aria-label="Side-by-side quotes" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 0 }}>
                <div style={{ borderRight: isMobile ? "none" : `1px solid ${COLORS.border}`, borderBottom: isMobile ? `1px solid ${COLORS.border}` : "none" }}>
                  <QuoteSide quote={quoteA} label={liveA} COLORS={COLORS} />
                </div>
                <div>
                  <QuoteSide quote={quoteB} label={liveB} COLORS={COLORS} />
                </div>
              </section>
            )}
            <section aria-label={`Normalized price chart: ${liveA} versus ${liveB}`} style={{ borderTop: `1px solid ${COLORS.border}`, padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1 }}>
                  NORMALIZED PRICE (% FROM START)
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["1mo", "3mo", "6mo", "1y", "ytd"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      style={{
                        background: range === r ? COLORS.purple : COLORS.bgInput,
                        color: range === r ? COLORS.white : COLORS.textMuted,
                        border: `1px solid ${COLORS.border}`, borderRadius: 3,
                        padding: "3px 8px", fontSize: 10, fontWeight: 700,
                        cursor: "pointer", textTransform: "uppercase",
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ height: 280 }}>
                {(loadA || loadB) && chartData.length === 0 ? (
                  <LoadingSpinner text="Loading price history..." />
                ) : (
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.textMuted }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: COLORS.textMuted }} tickFormatter={(v) => v.toFixed(0) + "%"} />
                      <Tooltip
                        contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }}
                        formatter={(v) => (v == null ? "—" : v.toFixed(2) + "%")}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="a" name={liveA} stroke={COLORS.purple} strokeWidth={2} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="b" name={liveB} stroke={COLORS.cyan} strokeWidth={2} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
            <section aria-label="Fundamentals comparison" style={{ borderTop: `1px solid ${COLORS.border}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>
                FUNDAMENTALS — {liveA} vs {liveB}
              </div>
              {(finLoadA || finLoadB) && !finA && !finB ? (
                <LoadingSpinner text="Loading fundamentals..." />
              ) : (
                <>
                  <CompareRow label="Gross Margin" aVal={parseFloat(finA?.margins?.gross)} bVal={parseFloat(finB?.margins?.gross)} format={(v) => v.toFixed(1)} suffix="%" higherIsBetter={true} COLORS={COLORS} />
                  <CompareRow label="Operating Margin" aVal={parseFloat(finA?.margins?.operating)} bVal={parseFloat(finB?.margins?.operating)} format={(v) => v.toFixed(1)} suffix="%" higherIsBetter={true} COLORS={COLORS} />
                  <CompareRow label="Profit Margin" aVal={parseFloat(finA?.margins?.profit)} bVal={parseFloat(finB?.margins?.profit)} format={(v) => v.toFixed(1)} suffix="%" higherIsBetter={true} COLORS={COLORS} />
                  <CompareRow
                    label="Latest Q Revenue"
                    aVal={finA?.quarterlyRevenue?.[finA.quarterlyRevenue.length - 1]?.revenue}
                    bVal={finB?.quarterlyRevenue?.[finB.quarterlyRevenue.length - 1]?.revenue}
                    format={(v) => fmtK(v)}
                    higherIsBetter={true}
                    COLORS={COLORS}
                  />
                  <CompareRow label="EPS (TTM)" aVal={quoteA?.eps} bVal={quoteB?.eps} format={(v) => fmt(v, 2)} higherIsBetter={true} COLORS={COLORS} />
                </>
              )}
            </section>
            <section aria-label="Ratios comparison" style={{ borderTop: `1px solid ${COLORS.border}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>
                RATIOS — {liveA} vs {liveB}
              </div>
              {(finLoadA || finLoadB) && !finA && !finB ? (
                <LoadingSpinner text="Loading ratios..." />
              ) : (
                <>
                  <CompareRow label="P/E (TTM)" aVal={finA?.ratios?.pe || quoteA?.pe} bVal={finB?.ratios?.pe || quoteB?.pe} format={(v) => v.toFixed(1)} suffix="x" higherIsBetter={false} COLORS={COLORS} />
                  <CompareRow label="P/S" aVal={finA?.ratios?.ps} bVal={finB?.ratios?.ps} format={(v) => v.toFixed(2)} suffix="x" higherIsBetter={false} COLORS={COLORS} />
                  <CompareRow label="P/B" aVal={finA?.ratios?.pb} bVal={finB?.ratios?.pb} format={(v) => v.toFixed(2)} suffix="x" higherIsBetter={false} COLORS={COLORS} />
                  <CompareRow label="EV/EBITDA" aVal={finA?.ratios?.evEbitda} bVal={finB?.ratios?.evEbitda} format={(v) => v.toFixed(1)} suffix="x" higherIsBetter={false} COLORS={COLORS} />
                  <CompareRow label="ROE" aVal={parseFloat(finA?.ratios?.roe)} bVal={parseFloat(finB?.ratios?.roe)} format={(v) => v.toFixed(1)} suffix="%" higherIsBetter={true} COLORS={COLORS} />
                  <CompareRow label="Debt / Equity" aVal={finA?.ratios?.debtToEquity} bVal={finB?.ratios?.debtToEquity} format={(v) => v.toFixed(2)} higherIsBetter={false} COLORS={COLORS} />
                </>
              )}
            </section>
            <section aria-label="Recent news" style={{ borderTop: `1px solid ${COLORS.border}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>
                RECENT NEWS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                {[liveA, liveB].map((tkr) => {
                  const items = (news || [])
                    .filter((n) => (n.relatedSymbol || "").toUpperCase() === tkr)
                    .slice(0, 3);
                  return (
                    <div key={tkr}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.purpleLight, marginBottom: 6, letterSpacing: 1 }}>
                        {tkr}
                      </div>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
                          No matching headlines in the current news feed.
                        </div>
                      ) : (
                        items.map((n) => (
                          <a key={n.uuid || n.link} href={n.link} target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", padding: "4px 0", borderBottom: `1px solid ${COLORS.border}22`, textDecoration: "none" }}>
                            <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.3, marginBottom: 2 }}>
                              {(n.title || "").slice(0, 120)}
                            </div>
                            <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                              {n.publisher || "—"}
                              {n.publishedAt ? ` · ${new Date(n.publishedAt * 1000).toLocaleDateString()}` : ""}
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </Panel>
    </div>
  );
}
