import { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Gem, Activity, Info, BarChart3, ChevronDown } from "lucide-react";
import { COMMODITY_SYMBOLS, fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, useHistorical, useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, DataCell, TabBar, LoadingSpinner } from "../shared";

// Pulls the contract month out of Yahoo's verbose front-month name. Yahoo
// returns things like "Crude Oil May 26", "Chicago SRW Wheat Futures,May-2026",
// or "Gold Jun 26". The year capture requires 2-4 digits; Yahoo sometimes
// truncates wheat to "May-2" which silently yields no match (no garbage shown).
const MONTH_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]?(\d{2,4})/i;
function extractContractMonth(longName) {
  if (!longName) return "";
  const m = longName.match(MONTH_RE);
  if (!m) return "";
  const mon = m[1].slice(0, 3).toUpperCase();
  const yr = m[2].length === 4 ? m[2].slice(-2) : m[2];
  return `${mon} '${yr}`;
}

// Format an ISO "YYYY-MM-DD" for chart XAxis ticks. On a short range we can
// show just MM-DD (one year is implied); on >1y ranges we prepend the year so
// 5Y charts are not ambiguous. Recharts passes raw string values through
// untouched unless we format them, so the helper is called from tickFormatter.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtAxisDate(iso, showYear) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mi = parseInt(m, 10) - 1;
  const mon = MONTHS_SHORT[mi] || m;
  return showYear ? `${mon} '${y.slice(-2)}` : `${mon} ${parseInt(d, 10)}`;
}
function fmtTooltipDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mi = parseInt(m, 10) - 1;
  const mon = MONTHS_SHORT[mi] || m;
  return `${mon} ${parseInt(d, 10)}, ${y}`;
}

// Yahoo's quote endpoint does not expose futures contract specs (exchange,
// contract size, tick value). The values below are the published specs for
// each exchange's front-month contract and are static reference data.
const CONTRACT_SPECS = {
  "CL=F": { exchange: "NYMEX", contractSize: "1,000 barrels",  tickSize: "$0.01 / bbl",    tickValue: "$10.00", category: "Energy" },
  "BZ=F": { exchange: "ICE",   contractSize: "1,000 barrels",  tickSize: "$0.01 / bbl",    tickValue: "$10.00", category: "Energy" },
  "GC=F": { exchange: "COMEX", contractSize: "100 troy oz",    tickSize: "$0.10 / oz",     tickValue: "$10.00", category: "Precious Metal" },
  "SI=F": { exchange: "COMEX", contractSize: "5,000 troy oz",  tickSize: "$0.005 / oz",    tickValue: "$25.00", category: "Precious Metal" },
  "NG=F": { exchange: "NYMEX", contractSize: "10,000 MMBtu",   tickSize: "$0.001 / MMBtu", tickValue: "$10.00", category: "Energy" },
  "HG=F": { exchange: "COMEX", contractSize: "25,000 lbs",     tickSize: "$0.0005 / lb",   tickValue: "$12.50", category: "Industrial Metal" },
  "ZW=F": { exchange: "CBOT",  contractSize: "5,000 bushels",  tickSize: "\u00A20.25 / bu", tickValue: "$12.50", category: "Agriculture" },
  "ZC=F": { exchange: "CBOT",  contractSize: "5,000 bushels",  tickSize: "\u00A20.25 / bu", tickValue: "$12.50", category: "Agriculture" },
};

export default function CommoditiesDashboard() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);

  const catColors = useMemo(() => ({
    "Energy":           COLORS.orange,
    "Precious Metal":   COLORS.gold,
    "Industrial Metal": COLORS.cyan,
    "Agriculture":      COLORS.green,
  }), [COLORS]);

  const cmdSymbols = useMemo(() => COMMODITY_SYMBOLS.map((c) => c.symbol), []);
  const { data: quotes, loading } = useQuotes(cmdSymbols, 20000);

  const [selectedSymbol, setSelectedSymbol] = useState(COMMODITY_SYMBOLS[0].symbol);
  const [tab, setTab] = useState("CHART");
  const [chartType, setChartType] = useState("area");
  const [chartRange, setChartRange] = useState("6mo");
  const [showList, setShowList] = useState(!isMobile);

  const commodities = useMemo(() => {
    return COMMODITY_SYMBOLS.map((c) => {
      const q = quotes.find((d) => d.symbol === c.symbol) || {};
      // `=F` tickers are continuous front-month series; Yahoo's name field
      // returns the current contract month (e.g. "Crude Oil May 26") which
      // changes on roll. Keep the clean static display name from config and
      // expose the contract month separately as `contractName`.
      return { ...q, ...c, contractName: q.longName || q.shortName || q.name || "" };
    });
  }, [quotes]);

  const selConfig = COMMODITY_SYMBOLS.find((c) => c.symbol === selectedSymbol) || COMMODITY_SYMBOLS[0];
  const selected = commodities.find((c) => c.symbol === selectedSymbol) || selConfig;
  const spec = CONTRACT_SPECS[selectedSymbol] || {};
  const selCatColor = catColors[spec.category] || COLORS.purple;

  const { data: histData, loading: histLoading } = useHistorical(selectedSymbol, chartRange);

  // Keep the raw ISO date so axis/tooltip formatters can decide how to render
  // it based on the selected range. Previously we pre-stripped "YYYY-" which
  // made multi-year charts ambiguous.
  const chartData = useMemo(() => {
    return histData.map((d) => ({
      date: d.date || "",
      price: d.close,
      open: d.open,
      high: d.high,
      low: d.low,
      volume: d.volume,
    }));
  }, [histData]);

  const showYearOnAxis = chartRange === "1y" || chartRange === "5y";

  // Period returns derived from the current historical window. retAt returns
  // null when the window is too short, so short ranges simply show fewer rows
  // rather than conflating a "1M" return with the edge of a 1mo window.
  const perf = useMemo(() => {
    if (!histData.length) return {};
    const n = histData.length;
    const last = histData[n - 1]?.close;
    if (!last) return {};
    const retAt = (daysBack) => {
      if (daysBack >= n) return null;
      const base = histData[n - 1 - daysBack]?.close;
      if (!base || base === 0) return null;
      return ((last - base) / base) * 100;
    };
    const ytd = (() => {
      const year = new Date().getFullYear();
      const first = histData.find((d) => d.date && d.date.startsWith(`${year}-`));
      if (!first || !first.close) return null;
      return ((last - first.close) / first.close) * 100;
    })();
    return {
      "1W":  retAt(5),
      "1M":  retAt(21),
      "3M":  retAt(63),
      "6M":  retAt(126),
      "YTD": ytd,
      "1Y":  retAt(252),
    };
  }, [histData]);

  // Mobile layout
  if (isMobile) {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        {/* Mobile commodity selector */}
        <div style={{ padding: "8px 12px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}` }}>
          <div
            onClick={() => setShowList(!showList)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", background: COLORS.bgInput,
              border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{selected.name}</span>
              <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(selected.price)}</span>
              <ChgVal val={selected.changePercent} />
            </div>
            <ChevronDown size={16} color={COLORS.textMuted} style={{ transform: showList ? "rotate(180deg)" : "none" }} />
          </div>
          {showList && (
            <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 4, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
              {commodities.map((c) => (
                <div
                  key={c.symbol}
                  onClick={() => { setSelectedSymbol(c.symbol); setShowList(false); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.border}22`,
                    background: selectedSymbol === c.symbol ? COLORS.purpleDim + "44" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{c.name}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(c.price)}</span>
                      <ChgVal val={c.changePercent} />
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>{c.unit}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile header */}
        <div style={{ padding: "8px 12px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{selected.name}</span>
            <Badge>{spec.exchange || "\u2014"}</Badge>
            <Badge color={selCatColor}>{spec.category || "\u2014"}</Badge>
          </div>
          {(() => {
            const cm = extractContractMonth(selected.contractName);
            return cm ? (
              <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
                Front month: {cm}
              </div>
            ) : null;
          })()}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <DataCell label="Last" value={fmt(selected.price)} sub={selected.unit} color={COLORS.gold} />
            <DataCell label="Chg" value={fmtPct(selected.changePercent)} color={(selected.changePercent ?? 0) >= 0 ? COLORS.green : COLORS.red} />
            <DataCell label="Volume" value={fmtK(selected.volume)} />
          </div>
        </div>

        <TabBar tabs={["CHART", "STATS", "SPEC"]} active={tab} onChange={setTab} />
        <div style={{ padding: 8 }}>
          {renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, spec, selCatColor, perf, COLORS, isMobile: true, showYearOnAxis })}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 0, height: "100%" }}>
      {/* COMMODITY LIST */}
      <div style={{ borderRight: `1px solid ${COLORS.border}`, overflowY: "auto", background: COLORS.bgPanel }}>
        <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 1, padding: "0 4px 4px", textTransform: "uppercase" }}>
            Commodities ({commodities.length})
          </div>
        </div>
        {loading && !quotes.length ? (
          <LoadingSpinner text="Loading commodities..." />
        ) : (
          commodities.map((c) => {
            const cSpec = CONTRACT_SPECS[c.symbol] || {};
            const cColor = catColors[cSpec.category] || COLORS.purple;
            const active = selectedSymbol === c.symbol;
            const contractMo = extractContractMonth(c.contractName);
            return (
              <div
                key={c.symbol}
                onClick={() => setSelectedSymbol(c.symbol)}
                style={{
                  padding: "8px 10px", cursor: "pointer",
                  borderBottom: `1px solid ${COLORS.border}22`,
                  background: active ? COLORS.purpleDim + "44" : "transparent",
                  borderLeft: active ? `3px solid ${COLORS.purple}` : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: active ? COLORS.purpleLight : COLORS.text }}>{c.name}</span>
                  <ChgVal val={c.changePercent} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: cColor, fontWeight: 600 }}>{cSpec.category || ""}</span>
                  <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(c.price)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
                  <span style={{ fontSize: 9, color: COLORS.textMuted }}>{c.unit}</span>
                  {contractMo && <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{contractMo}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ overflow: "auto" }}>
        <div style={{ padding: "12px 16px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Gem size={18} color={selCatColor} />
              <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{selected.name}</span>
              <span style={{ fontSize: 13, color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{selected.symbol}</span>
              <Badge>{spec.exchange || "\u2014"}</Badge>
              <Badge color={selCatColor}>{spec.category || "\u2014"}</Badge>
              {(() => {
                const cm = extractContractMonth(selected.contractName);
                return cm ? (
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
                    Front month: {cm}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <DataCell label={`Last (${selected.unit || ""})`} value={fmt(selected.price)} color={COLORS.gold} />
            <DataCell label="Change" value={fmtPct(selected.changePercent)} color={(selected.changePercent ?? 0) >= 0 ? COLORS.green : COLORS.red} />
            <DataCell label="Day High" value={fmt(selected.high)} />
            <DataCell label="Day Low" value={fmt(selected.low)} />
            <DataCell label="Volume" value={fmtK(selected.volume)} />
          </div>
        </div>

        <TabBar tabs={["CHART", "STATS", "SPEC"]} active={tab} onChange={setTab} />
        <div style={{ padding: 12 }}>
          {renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, spec, selCatColor, perf, COLORS, isMobile: false, showYearOnAxis })}
        </div>
      </div>
    </div>
  );
}

function renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, spec, selCatColor, perf, COLORS, isMobile, showYearOnAxis }) {
  if (tab === "CHART") {
    // Grains (wheat, corn) quote in cents; everything else in dollars. The
    // unit helper returns the prefix used on axis ticks and tooltip values.
    const unit = selected.unit || "";
    const isCents = unit.startsWith("\u00A2");
    const priceFmt = (v) => {
      if (v == null || isNaN(v)) return "\u2014";
      const pref = isCents ? "\u00A2" : "$";
      return pref + Number(v).toFixed(2);
    };
    const axisPriceFmt = (v) => {
      if (v == null || isNaN(v)) return "";
      const pref = isCents ? "\u00A2" : "$";
      return pref + Number(v).toFixed(v >= 100 ? 0 : 2);
    };
    const volumeFmt = (v) => (v ? fmtK(v) : "0");
    const xAxisFmt = (v) => fmtAxisDate(v, showYearOnAxis);
    const tooltipLabelFmt = (label) => fmtTooltipDate(label);
    // Recharts tooltip formatter: ("price" / "high" / "low" -> "Close" / "High" / "Low", formatted value)
    const seriesLabel = { price: "Close", high: "High", low: "Low", volume: "Volume" };
    const tooltipValueFmt = (value, name) => {
      if (name === "volume") return [volumeFmt(value), seriesLabel.volume];
      return [priceFmt(value), seriesLabel[name] || name];
    };
    const interval = Math.max(1, Math.floor(chartData.length / (isMobile ? 6 : 12)));
    const tooltipProps = {
      contentStyle: { background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, color: COLORS.text },
      labelStyle: { color: COLORS.textMuted, fontSize: 10, marginBottom: 2 },
      labelFormatter: tooltipLabelFmt,
      formatter: tooltipValueFmt,
    };

    return (
      <Panel>
        <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", alignItems: "center" }}>
          {["area", "line", "bar"].map((ct) => (
            <button key={ct} onClick={() => setChartType(ct)} style={{ padding: "4px 10px", fontSize: 10, border: `1px solid ${chartType === ct ? COLORS.purple : COLORS.border}`, borderRadius: 3, background: chartType === ct ? COLORS.purpleDim + "44" : "transparent", color: chartType === ct ? COLORS.purpleLight : COLORS.textMuted, cursor: "pointer" }}>
              {ct.toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: COLORS.border, margin: "0 2px" }} />
          {["1mo", "3mo", "6mo", "1y", "5y"].map((r) => (
            <button key={r} onClick={() => setChartRange(r)} style={{ padding: "4px 8px", fontSize: 10, border: `1px solid ${chartRange === r ? COLORS.purple : COLORS.border}`, borderRadius: 3, background: chartRange === r ? COLORS.purpleDim + "44" : "transparent", color: chartRange === r ? COLORS.purpleLight : COLORS.textMuted, cursor: "pointer" }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ padding: 8, height: isMobile ? 260 : 360 }}>
          {histLoading ? (
            <LoadingSpinner text="Loading chart data..." />
          ) : chartData.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.textMuted, fontSize: 12 }}>
              No chart data available for {selected.name}
            </div>
          ) : (
            <ResponsiveContainer>
              {chartType === "area" ? (
                <AreaChart data={chartData}>
                  <defs><linearGradient id="cmg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.35} /><stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={52} />
                  <Tooltip {...tooltipProps} />
                  <Area type="monotone" dataKey="price" stroke={COLORS.gold} fill="url(#cmg)" strokeWidth={2} name="Close" />
                </AreaChart>
              ) : chartType === "line" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={52} />
                  <Tooltip {...tooltipProps} />
                  <Line type="monotone" dataKey="price" stroke={COLORS.gold} strokeWidth={2} dot={false} name="Close" />
                  <Line type="monotone" dataKey="high" stroke={COLORS.green + "66"} strokeWidth={1} dot={false} strokeDasharray="4 2" name="High" />
                  <Line type="monotone" dataKey="low" stroke={COLORS.red + "66"} strokeWidth={1} dot={false} strokeDasharray="4 2" name="Low" />
                </LineChart>
              ) : (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis yAxisId="p" tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={52} />
                  <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 9, fill: COLORS.textMuted }} tickFormatter={volumeFmt} width={44} />
                  <Tooltip {...tooltipProps} />
                  <Bar yAxisId="v" dataKey="volume" fill={COLORS.purple + "33"} barSize={3} name="Volume" />
                  <Line yAxisId="p" type="monotone" dataKey="price" stroke={COLORS.gold} strokeWidth={2} dot={false} name="Close" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    );
  }

  if (tab === "STATS") {
    const { price, high, low, open, volume, week52High, week52Low } = selected;
    const dayRange = high != null && low != null ? high - low : null;
    const yearPos = (week52High != null && week52Low != null && price != null && week52High > week52Low)
      ? ((price - week52Low) / (week52High - week52Low)) * 100
      : null;

    const periodOrder = ["1W", "1M", "3M", "6M", "YTD", "1Y"];
    const perfRows = periodOrder.filter((k) => perf[k] != null);
    const unit = selected.unit || "";

    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        <Panel>
          <PanelHeader icon={<Activity size={14} color={COLORS.orange} />} title="PRICE ACTION" subtitle={`Current session & 52-week range${unit ? ` (${unit})` : ""}`} />
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <DataCell label="Open" value={fmt(open)} />
            <DataCell label="Last" value={fmt(price)} color={COLORS.gold} />
            <DataCell label="Day High" value={fmt(high)} />
            <DataCell label="Day Low" value={fmt(low)} />
            <DataCell label="Day Range" value={dayRange != null ? fmt(dayRange) : "\u2014"} />
            <DataCell label="Volume" value={fmtK(volume)} />
            <DataCell label="52W High" value={fmt(week52High)} />
            <DataCell label="52W Low" value={fmt(week52Low)} />
          </div>
          {yearPos != null && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 }}>52-WEEK POSITION</span>
                <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{yearPos.toFixed(0)}%</span>
              </div>
              <div style={{ height: 8, background: COLORS.bgPanel, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${COLORS.red}55, ${COLORS.orange}55 50%, ${COLORS.green}55)` }} />
                <div style={{ position: "absolute", left: `${Math.min(Math.max(yearPos, 0), 100)}%`, top: -2, bottom: -2, width: 2, background: COLORS.gold, transform: "translateX(-1px)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(week52Low)}</span>
                <span style={{ fontSize: 9, color: COLORS.green, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(week52High)}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader icon={<BarChart3 size={14} color={selCatColor} />} title="PERIOD RETURNS" subtitle="Trading-day offsets from current window" />
          <div style={{ padding: 14 }}>
            {perfRows.length === 0 ? (
              <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", padding: 20 }}>
                Select a longer chart range to compute period returns.
              </div>
            ) : (
              <>
                {perfRows.map((period) => {
                  const val = perf[period];
                  const w = Math.min(Math.abs(val), 50); // clamp visual bar to +/-50%
                  return (
                    <div key={period} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>{period}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: val >= 0 ? COLORS.green : COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>
                          {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: COLORS.border }} />
                        <div style={{
                          position: "absolute",
                          left: val >= 0 ? "50%" : `${50 - w}%`,
                          width: `${w}%`,
                          top: 0, bottom: 0,
                          background: val >= 0 ? COLORS.green : COLORS.red,
                          borderRadius: 2,
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, fontSize: 9, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.4 }}>
                  Returns use ~{`{5, 21, 63, 126, 252}`} trading-day offsets. Extend the chart range to unlock longer periods.
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  if (tab === "SPEC") {
    return (
      <Panel>
        <PanelHeader icon={<Info size={14} color={COLORS.cyan} />} title="CONTRACT SPECIFICATION" subtitle={`${selected.symbol} front-month futures`} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 14 }}>
            <DataCell label="Yahoo Symbol" value={selected.symbol} />
            <DataCell label="Exchange" value={spec.exchange || "\u2014"} />
            <DataCell label="Category" value={spec.category || "\u2014"} color={selCatColor} />
            <DataCell label="Contract Size" value={spec.contractSize || "\u2014"} />
            <DataCell label="Quote Unit" value={selected.unit || "\u2014"} />
            <DataCell label="Tick Size" value={spec.tickSize || "\u2014"} />
            <DataCell label="Tick Value" value={spec.tickValue || "\u2014"} />
            <DataCell label="Day High" value={fmt(selected.high)} />
            <DataCell label="Day Low" value={fmt(selected.low)} />
          </div>
          <div style={{ padding: 12, background: COLORS.bgPanel, borderRadius: 4, borderLeft: `3px solid ${COLORS.orange}` }}>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
              FRONT-MONTH CONTINUOUS SERIES
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
              Yahoo Finance publishes a continuous front-month price series for each futures ticker. Roll effects can distort returns around contract expiry, especially for energy contracts. Contract specs are static reference data from each exchange's rulebook — Yahoo's quote endpoint does not return them.
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return null;
}
