import { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Activity, Calculator, Building, PieChart as PieIcon,
} from "lucide-react";
import { COLORS, fmt, fmtK, fmtPct } from "../config";
import { useHistorical, useFinancials } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, DataCell, TabBar, MiniTable, LoadingSpinner } from "../shared";

export default function EquityAnalysis({ allStockQuotes }) {
  const stocks = allStockQuotes || [];
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0]?.symbol || "AAPL");
  const [tab, setTab] = useState("CHART");
  const [chartType, setChartType] = useState("area");
  const [chartRange, setChartRange] = useState("3mo");

  const selected = stocks.find((s) => s.symbol === selectedSymbol) || stocks[0] || {};
  const { data: histData, loading: histLoading } = useHistorical(selected.symbol, chartRange);
  const { data: finData, loading: finLoading } = useFinancials(selected.symbol);

  const chartData = useMemo(() => {
    return histData.map((d) => ({
      date: d.date?.slice(5) || "",
      price: d.close,
      open: d.open,
      high: d.high,
      low: d.low,
      volume: d.volume,
    }));
  }, [histData]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 0, height: "100%" }}>
      {/* STOCK LIST */}
      <div style={{ borderRight: `1px solid ${COLORS.border}`, overflowY: "auto", background: COLORS.bgPanel }}>
        <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 1, padding: "0 4px 4px", textTransform: "uppercase" }}>
            Securities ({stocks.length})
          </div>
        </div>
        {stocks.map((s) => (
          <div
            key={s.symbol}
            onClick={() => setSelectedSymbol(s.symbol)}
            style={{
              padding: "6px 10px",
              cursor: "pointer",
              borderBottom: `1px solid ${COLORS.border}22`,
              background: selectedSymbol === s.symbol ? COLORS.purpleDim + "44" : "transparent",
              borderLeft: selectedSymbol === s.symbol ? `3px solid ${COLORS.purple}` : "3px solid transparent",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: selectedSymbol === s.symbol ? COLORS.purpleLight : COLORS.text }}>
                {s.symbol?.replace(".DS", "")}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>
                {fmt(s.price)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, color: COLORS.textMuted }}>{(s.name || "").slice(0, 18)}</span>
              <ChgVal val={s.changePercent} />
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ overflow: "auto" }}>
        {/* HEADER */}
        <div style={{ padding: "12px 16px", background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{selected.symbol?.replace(".DS", "")}</span>
              <span style={{ fontSize: 13, color: COLORS.textDim }}>{selected.name}</span>
              <Badge>{selected.exchange || "—"}</Badge>
              <Badge color={COLORS.cyan}>{selected.currency || "USD"}</Badge>
              {selected.marketState && (
                <Badge color={selected.marketState === "REGULAR" ? COLORS.green : COLORS.orange}>
                  {selected.marketState === "REGULAR" ? "OPEN" : selected.marketState}
                </Badge>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <DataCell label="Last" value={fmt(selected.price)} color={COLORS.gold} />
            <DataCell label="Change" value={fmtPct(selected.changePercent)} color={selected.changePercent >= 0 ? COLORS.green : COLORS.red} />
            <DataCell label="Mkt Cap" value={fmtK(selected.marketCap)} />
            <DataCell label="P/E" value={selected.pe ? fmt(selected.pe, 1) : "N/A"} />
            <DataCell label="Volume" value={fmtK(selected.volume)} />
          </div>
        </div>

        <TabBar tabs={["CHART", "FINANCIALS", "ESTIMATES", "RATIOS", "PROFILE"]} active={tab} onChange={setTab} />

        <div style={{ padding: 12 }}>
          {tab === "CHART" && (
            <Panel>
              <div style={{ padding: "8px 12px", display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", alignItems: "center" }}>
                {["area", "line", "bar"].map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setChartType(ct)}
                    style={{
                      padding: "3px 10px", fontSize: 10,
                      border: `1px solid ${chartType === ct ? COLORS.purple : COLORS.border}`,
                      borderRadius: 3,
                      background: chartType === ct ? COLORS.purpleDim + "44" : "transparent",
                      color: chartType === ct ? COLORS.purpleLight : COLORS.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {ct.toUpperCase()}
                  </button>
                ))}
                <div style={{ width: 1, height: 16, background: COLORS.border, margin: "0 4px" }} />
                {["1mo", "3mo", "6mo", "1y", "5y"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    style={{
                      padding: "3px 8px", fontSize: 10,
                      border: `1px solid ${chartRange === r ? COLORS.purple : COLORS.border}`,
                      borderRadius: 3,
                      background: chartRange === r ? COLORS.purpleDim + "44" : "transparent",
                      color: chartRange === r ? COLORS.purpleLight : COLORS.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.textMuted }}>
                  {selected.symbol} | {chartRange}
                </span>
              </div>
              <div style={{ padding: 8, height: 320 }}>
                {histLoading ? (
                  <LoadingSpinner text="Loading chart data..." />
                ) : (
                  <ResponsiveContainer>
                    {chartType === "area" ? (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={Math.max(1, Math.floor(chartData.length / 12))} />
                        <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, color: COLORS.text }} />
                        <Area type="monotone" dataKey="price" stroke={COLORS.purple} fill="url(#gp)" strokeWidth={2} />
                      </AreaChart>
                    ) : chartType === "line" ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={Math.max(1, Math.floor(chartData.length / 12))} />
                        <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, color: COLORS.text }} />
                        <Line type="monotone" dataKey="price" stroke={COLORS.green} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="high" stroke={COLORS.purple + "66"} strokeWidth={1} dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="low" stroke={COLORS.red + "66"} strokeWidth={1} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    ) : (
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.textMuted }} interval={Math.max(1, Math.floor(chartData.length / 12))} />
                        <YAxis yAxisId="p" tick={{ fontSize: 9, fill: COLORS.textMuted }} domain={["auto", "auto"]} />
                        <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 9, fill: COLORS.textMuted }} />
                        <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, color: COLORS.text }} />
                        <Bar yAxisId="v" dataKey="volume" fill={COLORS.purple + "33"} barSize={3} />
                        <Line yAxisId="p" type="monotone" dataKey="price" stroke={COLORS.green} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          )}

          {tab === "FINANCIALS" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Panel>
                <PanelHeader icon={<TrendingUp size={14} color={COLORS.green} />} title="QUARTERLY EARNINGS" subtitle="Revenue & Earnings" />
                <div style={{ padding: 8, height: 220 }}>
                  {finLoading ? (
                    <LoadingSpinner />
                  ) : finData?.quarterlyRevenue?.length ? (
                    <ResponsiveContainer>
                      <BarChart data={finData.quarterlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                        <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: COLORS.textMuted }} />
                        <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} tickFormatter={(v) => fmtK(v)} />
                        <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} formatter={(v) => fmtK(v)} />
                        <Bar dataKey="revenue" fill={COLORS.purple} radius={[3, 3, 0, 0]} barSize={24} name="Revenue" />
                        <Bar dataKey="earnings" fill={COLORS.green} radius={[3, 3, 0, 0]} barSize={24} name="Earnings" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <LoadingSpinner text="No quarterly data available" />
                  )}
                </div>
              </Panel>
              <Panel>
                <PanelHeader icon={<PieIcon size={14} color={COLORS.orange} />} title="MARGIN ANALYSIS" subtitle="Profitability metrics" />
                <div style={{ padding: 12 }}>
                  {finLoading ? (
                    <LoadingSpinner />
                  ) : (
                    Object.entries(finData?.margins || {}).map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: COLORS.textDim, textTransform: "capitalize" }}>{k} Margin</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.green, fontFamily: "'JetBrains Mono',monospace" }}>{v}%</span>
                        </div>
                        <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(Math.max(parseFloat(v) || 0, 0), 100)}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.purpleDark}, ${COLORS.purple})`, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          )}

          {tab === "ESTIMATES" && (
            <Panel>
              <PanelHeader icon={<Activity size={14} color={COLORS.cyan} />} title="ANALYST ESTIMATES" subtitle="Consensus recommendations" />
              {finLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                    <DataCell label="EPS Estimate" value={finData?.estimates?.epsEstimate ? `$${fmt(finData.estimates.epsEstimate)}` : "N/A"} sub={finData?.estimates?.epsPrev ? `Prev: $${fmt(finData.estimates.epsPrev)}` : ""} />
                    <DataCell label="Revenue Growth" value={finData?.estimates?.revenueEstimate || "N/A"} />
                    <DataCell label="Price Target (Mean)" value={finData?.estimates?.targetMean ? `$${fmt(finData.estimates.targetMean)}` : "N/A"} color={COLORS.gold} />
                    <DataCell label="Target Range" value={finData?.estimates?.targetLow && finData?.estimates?.targetHigh ? `$${fmt(finData.estimates.targetLow, 0)} - $${fmt(finData.estimates.targetHigh, 0)}` : "N/A"} />
                  </div>
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      {[
                        { l: "BUY", c: COLORS.green, w: finData?.recommendations?.buy || 0 },
                        { l: "HOLD", c: COLORS.orange, w: finData?.recommendations?.hold || 0 },
                        { l: "SELL", c: COLORS.red, w: finData?.recommendations?.sell || 0 },
                      ].map((r) => (
                        <div key={r.l} style={{ flex: Math.max(r.w, 5) }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: r.c }}>{r.l}</span>
                            <span style={{ fontSize: 11, color: COLORS.textDim }}>{r.w}%</span>
                          </div>
                          <div style={{ height: 8, background: r.c + "22", borderRadius: 4 }}>
                            <div style={{ width: `${r.w}%`, height: "100%", background: r.c, borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Panel>
          )}

          {tab === "RATIOS" && (
            <Panel>
              <PanelHeader icon={<Calculator size={14} color={COLORS.purple} />} title="VALUATION & RATIOS" subtitle="Key financial ratios" />
              {finLoading ? (
                <LoadingSpinner />
              ) : (
                <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {Object.entries(finData?.ratios || {}).map(([k, v]) => (
                    <DataCell key={k} label={k.replace(/([A-Z])/g, " $1").toUpperCase()} value={v ? fmt(parseFloat(v), 2) + "x" : "N/A"} />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "PROFILE" && (
            <Panel>
              <PanelHeader icon={<Building size={14} color={COLORS.blue} />} title="COMPANY PROFILE" subtitle="Overview & description" />
              {finLoading ? (
                <LoadingSpinner />
              ) : (
                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <DataCell label="Sector" value={finData?.profile?.sector || "N/A"} />
                    <DataCell label="Industry" value={finData?.profile?.industry || "N/A"} />
                    <DataCell label="Country" value={finData?.profile?.country || "N/A"} />
                    <DataCell label="Employees" value={finData?.profile?.employees ? fmtK(finData.profile.employees) : "N/A"} />
                    <DataCell label="Market Cap" value={fmtK(selected.marketCap)} />
                    <DataCell label="52W Range" value={`${fmt(selected.week52Low, 0)} - ${fmt(selected.week52High, 0)}`} />
                  </div>
                  {finData?.profile?.website && (
                    <div style={{ marginBottom: 12 }}>
                      <a href={finData.profile.website} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 12 }}>
                        {finData.profile.website}
                      </a>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, maxHeight: 200, overflowY: "auto" }}>
                    {finData?.profile?.summary || `${selected.name} trades under the ticker ${selected.symbol} with a market capitalization of ${fmtK(selected.marketCap)}.`}
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
