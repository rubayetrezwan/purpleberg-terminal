import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, LineChart, Line, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Bitcoin, Activity, Info, BarChart3, ChevronDown } from "lucide-react";
import { fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useCryptoMarkets, useCryptoChart, useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, DataCell, TabBar, LoadingSpinner } from "../shared";

// Crypto dashboard. Top-20 markets and historical series come from CoinGecko
// via the Express proxy (/api/crypto/*). Layout intentionally mirrors
// CommoditiesDashboard so the look and feel stay consistent across the
// terminal's sidebar entries.

// Market-cap tier used to pick a category colour on the sidebar and header.
// CoinGecko's `market_cap_rank` is 1-indexed across the whole universe; we
// only render the top 20, so the thresholds are conservative.
function tierFor(rank) {
  if (!rank) return "Alt";
  if (rank <= 2) return "Major";
  if (rank <= 10) return "Large-Cap";
  return "Mid-Cap";
}

// Re-used from the commodities screen. Kept local to avoid a cross-screen
// import just for two tiny formatters.
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

// CoinGecko prices span ten orders of magnitude (BTC ~$100k, SHIB ~$0.00001).
// Pick precision so a SHIB tick isn't "$0.00".
function priceDecimals(price) {
  if (price == null || isNaN(price)) return 2;
  const p = Math.abs(Number(price));
  if (p === 0) return 2;
  if (p >= 1000) return 0;
  if (p >= 1) return 2;
  if (p >= 0.01) return 4;
  if (p >= 0.0001) return 6;
  return 8;
}
function fmtPrice(v) {
  if (v == null || isNaN(v)) return "\u2014";
  return Number(v).toFixed(priceDecimals(v));
}
function fmtSupply(n) {
  if (n == null || n === 0) return "\u2014";
  return fmtK(n);
}
function fmtAthDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function CryptoDashboard() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);

  const tierColors = useMemo(() => ({
    "Major":      COLORS.gold,
    "Large-Cap":  COLORS.purpleLight,
    "Mid-Cap":    COLORS.cyan,
    "Alt":        COLORS.textDim,
  }), [COLORS]);

  const { data: coins, loading } = useCryptoMarkets(30000);

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("CHART");
  const [chartType, setChartType] = useState("area");
  const [chartRange, setChartRange] = useState("3mo");
  const [showList, setShowList] = useState(!isMobile);

  // Lock onto the top coin once the first payload arrives, then leave the
  // selection alone so the user's choice sticks across polls.
  useEffect(() => {
    if (!selectedId && coins.length > 0) setSelectedId(coins[0].id);
  }, [coins, selectedId]);

  const selected = coins.find((c) => c.id === selectedId) || coins[0] || {};
  const selTier = tierFor(selected.marketCapRank);
  const selTierColor = tierColors[selTier] || COLORS.purple;

  const { data: histData, loading: histLoading } = useCryptoChart(selectedId, chartRange);

  const chartData = useMemo(() => {
    return histData.map((d) => ({
      date: d.date || "",
      price: d.close,
      volume: d.volume,
    }));
  }, [histData]);

  const showYearOnAxis = chartRange === "1y" || chartRange === "5y" || chartRange === "max";

  // Crypto trades 24/7, so period returns use calendar-day offsets rather
  // than the trading-day offsets the equity/commodities screens use.
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
      "1W":  retAt(7),
      "1M":  retAt(30),
      "3M":  retAt(90),
      "6M":  retAt(180),
      "YTD": ytd,
      "1Y":  retAt(365),
    };
  }, [histData]);

  if (loading && coins.length === 0) {
    return <LoadingSpinner text="Loading top 20 cryptocurrencies..." />;
  }

  if (!selected.id) {
    return (
      <div style={{ padding: 24, color: COLORS.textMuted, fontSize: 12 }}>
        No crypto data available. The CoinGecko upstream may be rate-limiting; try again in a minute.
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
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
              <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>${fmtPrice(selected.price)}</span>
              <ChgVal val={selected.changePercent24h} />
            </div>
            <ChevronDown size={16} color={COLORS.textMuted} style={{ transform: showList ? "rotate(180deg)" : "none" }} />
          </div>
          {showList && (
            <div style={{ maxHeight: 280, overflowY: "auto", marginTop: 4, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
              {coins.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setShowList(false); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.border}22`,
                    background: selectedId === c.id ? COLORS.purpleDim + "44" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                      {c.name}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>${fmtPrice(c.price)}</span>
                      <ChgVal val={c.changePercent24h} />
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>{c.symbol}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "8px 12px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{selected.name}</span>
            <Badge>{selected.symbol}</Badge>
            <Badge color={selTierColor}>{selTier}</Badge>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <DataCell label="Last" value={`$${fmtPrice(selected.price)}`} color={COLORS.gold} />
            <DataCell label="24h Chg" value={fmtPct(selected.changePercent24h)} color={(selected.changePercent24h ?? 0) >= 0 ? COLORS.green : COLORS.red} />
            <DataCell label="Mkt Cap" value={`$${fmtSupply(selected.marketCap)}`} />
          </div>
        </div>

        <TabBar tabs={["CHART", "STATS", "ABOUT"]} active={tab} onChange={setTab} />
        <div style={{ padding: 8 }}>
          {renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, selTier, selTierColor, perf, COLORS, isMobile: true, showYearOnAxis })}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 0, height: "100%" }}>
      {/* COIN LIST */}
      <div style={{ borderRight: `1px solid ${COLORS.border}`, overflowY: "auto", background: COLORS.bgPanel }}>
        <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 1, padding: "0 4px 4px", textTransform: "uppercase" }}>
            Top Cryptos ({coins.length})
          </div>
        </div>
        {coins.map((c) => {
          const active = selectedId === c.id;
          const tier = tierFor(c.marketCapRank);
          const tierColor = tierColors[tier] || COLORS.purple;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                padding: "8px 10px", cursor: "pointer",
                borderBottom: `1px solid ${COLORS.border}22`,
                background: active ? COLORS.purpleDim + "44" : "transparent",
                borderLeft: active ? `3px solid ${COLORS.purple}` : "3px solid transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? COLORS.purpleLight : COLORS.text }}>
                  {c.name}
                </span>
                <ChgVal val={c.changePercent24h} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: tierColor, fontWeight: 600 }}>{c.symbol}</span>
                <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>${fmtPrice(c.price)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
                <span style={{ fontSize: 9, color: COLORS.textMuted }}>Mkt Cap</span>
                <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>${fmtSupply(c.marketCap)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ overflow: "auto" }}>
        <div style={{ padding: "12px 16px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Bitcoin size={18} color={selTierColor} />
              <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{selected.name}</span>
              <span style={{ fontSize: 13, color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{selected.symbol}</span>
              <Badge color={selTierColor}>{selTier}</Badge>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <DataCell label="Last (USD)" value={`$${fmtPrice(selected.price)}`} color={COLORS.gold} />
            <DataCell label="24h Change" value={fmtPct(selected.changePercent24h)} color={(selected.changePercent24h ?? 0) >= 0 ? COLORS.green : COLORS.red} />
            <DataCell label="24h High" value={`$${fmtPrice(selected.high24h)}`} />
            <DataCell label="24h Low" value={`$${fmtPrice(selected.low24h)}`} />
            <DataCell label="24h Volume" value={`$${fmtSupply(selected.volume24h)}`} />
            <DataCell label="Market Cap" value={`$${fmtSupply(selected.marketCap)}`} />
          </div>
        </div>

        <TabBar tabs={["CHART", "STATS", "ABOUT"]} active={tab} onChange={setTab} />
        <div style={{ padding: 12 }}>
          {renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, selTier, selTierColor, perf, COLORS, isMobile: false, showYearOnAxis })}
        </div>
      </div>
    </div>
  );
}

function renderTabContent({ tab, chartType, setChartType, chartRange, setChartRange, histLoading, chartData, selected, selTier, selTierColor, perf, COLORS, isMobile, showYearOnAxis }) {
  if (tab === "CHART") {
    const priceFmtTooltip = (v) => v == null || isNaN(v) ? "\u2014" : "$" + Number(v).toFixed(priceDecimals(v));
    const axisPriceFmt = (v) => {
      if (v == null || isNaN(v)) return "";
      const d = priceDecimals(v);
      return "$" + Number(v).toFixed(Math.min(d, v >= 100 ? 0 : d));
    };
    const volumeFmt = (v) => (v ? "$" + fmtK(v) : "0");
    const xAxisFmt = (v) => fmtAxisDate(v, showYearOnAxis);
    const tooltipLabelFmt = (label) => fmtTooltipDate(label);
    const seriesLabel = { price: "Close", volume: "Volume" };
    const tooltipValueFmt = (value, name) => {
      if (name === "volume") return [volumeFmt(value), seriesLabel.volume];
      return [priceFmtTooltip(value), seriesLabel[name] || name];
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
                  <defs><linearGradient id="crg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.35} /><stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={64} />
                  <Tooltip {...tooltipProps} />
                  <Area type="monotone" dataKey="price" stroke={COLORS.gold} fill="url(#crg)" strokeWidth={2} name="Close" />
                </AreaChart>
              ) : chartType === "line" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={64} />
                  <Tooltip {...tooltipProps} />
                  <Line type="monotone" dataKey="price" stroke={COLORS.gold} strokeWidth={2} dot={false} name="Close" />
                </LineChart>
              ) : (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={interval} tickFormatter={xAxisFmt} minTickGap={20} />
                  <YAxis yAxisId="p" tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} tickFormatter={axisPriceFmt} width={64} />
                  <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 9, fill: COLORS.textMuted }} tickFormatter={volumeFmt} width={52} />
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
    const { price, high24h, low24h, volume24h, marketCap, marketCapRank, ath, athChangePercent, atl, atlChangePercent } = selected;
    const dayRange = high24h != null && low24h != null ? high24h - low24h : null;
    const athPos = (ath != null && ath > 0 && price != null) ? (price / ath) * 100 : null;

    const periodOrder = ["1W", "1M", "3M", "6M", "YTD", "1Y"];
    const perfRows = periodOrder.filter((k) => perf[k] != null);

    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        <Panel>
          <PanelHeader icon={<Activity size={14} color={COLORS.orange} />} title="PRICE ACTION" subtitle="24h session & all-time reference" />
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <DataCell label="Last" value={`$${fmtPrice(price)}`} color={COLORS.gold} />
            <DataCell label="Rank" value={marketCapRank ? `#${marketCapRank}` : "\u2014"} color={selTierColor} />
            <DataCell label="24h High" value={`$${fmtPrice(high24h)}`} />
            <DataCell label="24h Low" value={`$${fmtPrice(low24h)}`} />
            <DataCell label="24h Range" value={dayRange != null ? `$${fmtPrice(dayRange)}` : "\u2014"} />
            <DataCell label="24h Volume" value={`$${fmtSupply(volume24h)}`} />
            <DataCell label="Market Cap" value={`$${fmtSupply(marketCap)}`} />
            <DataCell label="Tier" value={selTier} color={selTierColor} />
          </div>
          {athPos != null && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 }}>{"ATL \u2192 ATH POSITION"}</span>
                <span style={{ fontSize: 11, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{athPos.toFixed(0)}% of ATH</span>
              </div>
              <div style={{ height: 8, background: COLORS.bgPanel, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${COLORS.red}55, ${COLORS.orange}55 50%, ${COLORS.green}55)` }} />
                <div style={{ position: "absolute", left: `${Math.min(Math.max(athPos, 0), 100)}%`, top: -2, bottom: -2, width: 2, background: COLORS.gold, transform: "translateX(-1px)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>${fmtPrice(atl)}</span>
                <span style={{ fontSize: 9, color: COLORS.green, fontFamily: "'JetBrains Mono',monospace" }}>${fmtPrice(ath)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: COLORS.textDim }}>
                <span>ATL {(atlChangePercent ?? 0) >= 0 ? "+" : ""}{(atlChangePercent ?? 0).toFixed(1)}%</span>
                <span>ATH {(athChangePercent ?? 0) >= 0 ? "+" : ""}{(athChangePercent ?? 0).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader icon={<BarChart3 size={14} color={selTierColor} />} title="PERIOD RETURNS" subtitle="Calendar-day offsets from current window" />
          <div style={{ padding: 14 }}>
            {perfRows.length === 0 ? (
              <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", padding: 20 }}>
                Select a longer chart range to compute period returns.
              </div>
            ) : (
              <>
                {perfRows.map((period) => {
                  const val = perf[period];
                  const w = Math.min(Math.abs(val), 50);
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
                  Returns use calendar-day offsets (7/30/90/180/365). Extend the chart range to unlock longer periods.
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  if (tab === "ABOUT") {
    const { circulatingSupply, totalSupply, maxSupply, symbol, athDate, atlDate, lastUpdated, ath, atl } = selected;
    const pctCirc = (totalSupply && totalSupply > 0) ? (circulatingSupply / totalSupply) * 100 : null;
    const pctMax = (maxSupply && maxSupply > 0) ? (circulatingSupply / maxSupply) * 100 : null;

    return (
      <Panel>
        <PanelHeader icon={<Info size={14} color={COLORS.cyan} />} title="COIN REFERENCE" subtitle={`${selected.name} (${symbol}) supply & all-time levels`} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 14 }}>
            <DataCell label="Symbol" value={symbol || "\u2014"} />
            <DataCell label="Rank" value={selected.marketCapRank ? `#${selected.marketCapRank}` : "\u2014"} color={selTierColor} />
            <DataCell label="Tier" value={selTier} color={selTierColor} />
            <DataCell label="Circulating" value={fmtSupply(circulatingSupply)} sub={symbol || ""} />
            <DataCell label="Total Supply" value={fmtSupply(totalSupply)} sub={symbol || ""} />
            <DataCell label="Max Supply" value={maxSupply ? fmtSupply(maxSupply) : "Uncapped"} sub={maxSupply ? (symbol || "") : ""} />
            <DataCell label="All-Time High" value={`$${fmtPrice(ath)}`} sub={fmtAthDate(athDate)} color={COLORS.green} />
            <DataCell label="All-Time Low" value={`$${fmtPrice(atl)}`} sub={fmtAthDate(atlDate)} color={COLORS.red} />
            <DataCell label="Last Updated" value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "\u2014"} />
          </div>

          {(pctCirc != null || pctMax != null) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>
                SUPPLY UTILISATION
              </div>
              {pctMax != null && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: COLORS.textDim }}>Circulating vs. Max</span>
                    <span style={{ fontSize: 10, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{pctMax.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(pctMax, 100)}%`, height: "100%", background: COLORS.gold }} />
                  </div>
                </div>
              )}
              {pctCirc != null && pctMax == null && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: COLORS.textDim }}>Circulating vs. Total</span>
                    <span style={{ fontSize: 10, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>{pctCirc.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(pctCirc, 100)}%`, height: "100%", background: COLORS.gold }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ padding: 12, background: COLORS.bgPanel, borderRadius: 4, borderLeft: `3px solid ${COLORS.cyan}` }}>
            <div style={{ fontSize: 10, color: COLORS.cyan, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
              DATA SOURCE
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
              Prices, supply and all-time levels come from the CoinGecko public API through the Purpleberg proxy. Crypto markets trade 24/7, so the "24h" figures roll continuously rather than resetting at exchange close. ATH and ATL are peak and trough across CoinGecko's full history for the asset.
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return null;
}
