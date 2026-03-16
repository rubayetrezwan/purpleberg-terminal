import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Calculator, Activity, ChevronDown } from "lucide-react";
import { FX_SYMBOLS, fmt, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, useHistorical, useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, DataCell, LoadingSpinner } from "../shared";

export default function FXDashboard() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const fxSymbols = useMemo(() => FX_SYMBOLS.map((f) => f.symbol), []);
  const { data: fxQuotes, loading } = useQuotes(fxSymbols, 10000);
  const [selPairSymbol, setSelPairSymbol] = useState(FX_SYMBOLS[0].symbol);
  const [calcFrom, setCalcFrom] = useState("1000");
  const [showPairList, setShowPairList] = useState(false);

  const selConfig = FX_SYMBOLS.find((f) => f.symbol === selPairSymbol) || FX_SYMBOLS[0];
  const selQuote = fxQuotes.find((q) => q.symbol === selPairSymbol);

  const { data: histData, loading: histLoading } = useHistorical(selPairSymbol, "3mo");

  const chartData = useMemo(() => {
    return histData.map((d) => ({ date: d.date?.slice(5) || "", price: d.close }));
  }, [histData]);

  const fxPairs = FX_SYMBOLS.map((f) => {
    const q = fxQuotes.find((d) => d.symbol === f.symbol);
    return { ...f, price: q?.price ?? 0, change: q?.change ?? 0, changePercent: q?.changePercent ?? 0, open: q?.open ?? 0, high: q?.high ?? 0, low: q?.low ?? 0 };
  });

  const bid = selQuote?.price ?? 0;
  const high = selQuote?.high ?? 0;
  const low = selQuote?.low ?? 0;
  const dayRange = high - low;
  const spreadPips = bid > 0 ? ((dayRange * 0.01) / bid * 10000).toFixed(1) : "0.0";

  if (isMobile) {
    return (
      <div style={{ overflow: "auto" }}>
        {/* Mobile pair selector */}
        <div style={{ padding: 8, background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}` }}>
          <div onClick={() => setShowPairList(!showPairList)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: "pointer" }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{selConfig.pair}</span>
              <span style={{ fontSize: 11, color: COLORS.green, marginLeft: 8, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(bid, 4)}</span>
            </div>
            <ChevronDown size={16} color={COLORS.textMuted} />
          </div>
          {showPairList && (
            <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 4, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
              {fxPairs.map((p) => (
                <div key={p.symbol} onClick={() => { setSelPairSymbol(p.symbol); setShowPairList(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}22`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{p.pair}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: COLORS.green, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(p.price, 4)}</span>
                    <ChgVal val={p.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ padding: 8 }}>
          <Panel>
            <PanelHeader icon={<TrendingUp size={14} color={COLORS.purple} />} title={`${selConfig.pair} — 90 DAY`} />
            <div style={{ padding: 8, height: 220 }}>
              {histLoading ? <LoadingSpinner text="Loading chart..." /> : (
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="fxg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={Math.max(1, Math.floor(chartData.length / 6))} />
                    <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                    <Area type="monotone" dataKey="price" stroke={COLORS.cyan} fill="url(#fxg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Stats + Calculator stacked */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <Panel>
              <PanelHeader icon={<Activity size={14} color={COLORS.orange} />} title="PAIR STATS" />
              <div style={{ padding: 10 }}>
                <DataCell label="Rate" value={fmt(bid, 4)} color={COLORS.green} />
                <DataCell label="Spread" value={spreadPips + " pips"} />
                <DataCell label="Change" value={fmtPct(selQuote?.changePercent ?? 0)} color={(selQuote?.changePercent ?? 0) >= 0 ? COLORS.green : COLORS.red} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader icon={<Calculator size={14} color={COLORS.gold} />} title="CALCULATOR" />
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{selConfig.pair.split("/")[0]}</div>
                <input value={calcFrom} onChange={(e) => setCalcFrom(e.target.value)} style={{ width: "100%", padding: 6, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.text, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box" }} />
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 6 }}>{selConfig.pair.split("/")[1]}</div>
                <div style={{ padding: 6, background: COLORS.purpleDim + "33", borderRadius: 4, fontSize: 16, fontWeight: 700, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmt(parseFloat(calcFrom || 0) * bid, 4)}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 0 }}>
      <div style={{ borderRight: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, overflowY: "auto" }}>
        <PanelHeader icon={<DollarSign size={14} color={COLORS.green} />} title="FX RATES" subtitle="Real-time exchange rates" />
        {loading ? (
          <LoadingSpinner text="Loading FX rates..." />
        ) : (
          fxPairs.map((p) => (
            <div key={p.symbol} onClick={() => setSelPairSymbol(p.symbol)} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}22`, background: selPairSymbol === p.symbol ? COLORS.purpleDim + "44" : "transparent", borderLeft: selPairSymbol === p.symbol ? `3px solid ${COLORS.purple}` : "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{p.pair}</span>
                <ChgVal val={p.changePercent} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: COLORS.green, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(p.price, 4)}</span>
                <span style={{ fontSize: 9, color: COLORS.textMuted }}>{p.change >= 0 ? "+" : ""}{fmt(p.change, 4)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ overflow: "auto" }}>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 300px", gap: 10 }}>
          <Panel>
            <PanelHeader icon={<TrendingUp size={14} color={COLORS.purple} />} title={`${selConfig.pair} — 90 DAY CHART`} subtitle="Historical exchange rate" />
            <div style={{ padding: 8, height: 300 }}>
              {histLoading ? <LoadingSpinner text="Loading chart..." /> : (
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="fxg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={Math.max(1, Math.floor(chartData.length / 8))} />
                    <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                    <Area type="monotone" dataKey="price" stroke={COLORS.cyan} fill="url(#fxg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Panel>
              <PanelHeader icon={<Calculator size={14} color={COLORS.gold} />} title="FX CALCULATOR" />
              <div style={{ padding: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Amount ({selConfig.pair.split("/")[0]})</div>
                  <input value={calcFrom} onChange={(e) => setCalcFrom(e.target.value)} style={{ width: "100%", padding: 8, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.text, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>Converted ({selConfig.pair.split("/")[1]})</div>
                <div style={{ padding: 8, background: COLORS.purpleDim + "33", borderRadius: 4, fontSize: 18, fontWeight: 700, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmt(parseFloat(calcFrom || 0) * bid, 4)}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textDim }}>Rate: 1 {selConfig.pair.split("/")[0]} = {fmt(bid, 4)} {selConfig.pair.split("/")[1]}</div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader icon={<Activity size={14} color={COLORS.orange} />} title="PAIR STATS" />
              <div style={{ padding: 12 }}>
                <DataCell label="Rate" value={fmt(bid, 4)} color={COLORS.green} />
                <DataCell label="Spread (est)" value={spreadPips + " pips"} />
                <DataCell label="Day Change" value={fmtPct(selQuote?.changePercent ?? 0)} color={(selQuote?.changePercent ?? 0) >= 0 ? COLORS.green : COLORS.red} />
                <DataCell label="Day High" value={fmt(selQuote?.high ?? 0, 4)} />
                <DataCell label="Day Low" value={fmt(selQuote?.low ?? 0, 4)} />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
