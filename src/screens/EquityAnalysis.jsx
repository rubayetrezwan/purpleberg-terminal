import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Activity, Calculator, Building, PieChart as PieIcon,
} from "lucide-react";
import { fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useHistorical, useFinancials } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, DataCell, TabBar, MiniTable, LoadingSpinner } from "../shared";

export default function EquityAnalysis({ allStockQuotes }) {
  const COLORS = useColors();
  const stocks = allStockQuotes || [];
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [tab, setTab] = useState("CHART");
  const [chartType, setChartType] = useState("area");
  const [chartRange, setChartRange] = useState("3mo");

  // Auto-select first US stock when data loads (skip DSE stocks for charts)
  useEffect(() => {
    if (stocks.length > 0 && !stocks.find((s) => s.symbol === selectedSymbol)) {
      const usStock = stocks.find((s) => s.exchange !== "DSE");
      if (usStock) setSelectedSymbol(usStock.symbol);
      else setSelectedSymbol(stocks[0].symbol);
    }
  }, [stocks.length]);

  const selected = stocks.find((s) => s.symbol === selectedSymbol) || stocks[0] || {};
  const isDSE = selected.exchange === "DSE";
  const { data: histData, loading: histLoading } = useHistorical(isDSE ? null : selected.symbol, chartRange);
  const { data: finData, loading: finLoading } = useFinancials(isDSE ? null : selected.symbol);

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
              <Badge>{selected.exchange || "\u2014"}</Badge>
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
                {isDSE ? (() => {
                  const o = selected.open || selected.price;
                  const h = selected.high || selected.price;
                  const l = selected.low || selected.price;
                  const c = selected.price;
                  const ycp = selected.prevClose || c;
                  const bullish = c >= ycp;
                  const barColor = bullish ? COLORS.green : COLORS.red;

                  // Build a bar chart from OHLC price levels
                  const dseChartData = [
                    { name: "YCP", value: ycp, fill: COLORS.orange },
                    { name: "Open", value: o, fill: COLORS.cyan },
                    { name: "High", value: h, fill: COLORS.green },
                    { name: "Low", value: l, fill: COLORS.red },
                    { name: "LTP", value: c, fill: barColor },
                  ];
                  const allVals = [ycp, o, h, l, c].filter((v) => v > 0);
                  const minVal = Math.min(...allVals);
                  const maxVal = Math.max(...allVals);
                  const domainPad = Math.max((maxVal - minVal) * 0.5, maxVal * 0.01);

                  return (
                    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
                      {/* OHLC Bar Chart using Recharts */}
                      <div style={{ padding: "4px 0" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dseChartData} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted, fontWeight: 600 }} />
                            <YAxis
                              tick={{ fontSize: 9, fill: COLORS.textMuted }}
                              domain={[minVal - domainPad, maxVal + domainPad]}
                              tickFormatter={(v) => fmt(v)}
                            />
                            <Tooltip
                              contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, color: COLORS.text }}
                              formatter={(v) => [fmt(v) + " BDT", "Price"]}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                              {dseChartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Right side: Price + Stats */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
                        <div>
                          <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>
                            {fmt(c)}
                          </span>
                          <span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 6 }}>BDT</span>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                            <ChgVal val={selected.changePercent} />
                            <span style={{ fontSize: 11, color: barColor, fontFamily: "'JetBrains Mono',monospace" }}>
                              {selected.change >= 0 ? "+" : ""}{fmt(selected.change)}
                            </span>
                          </div>
                        </div>

                        {/* Day range bar */}
                        {l > 0 && h > 0 && h !== l && (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 9, color: COLORS.red }}>{fmt(l)}</span>
                              <span style={{ fontSize: 9, color: COLORS.textMuted }}>DAY RANGE</span>
                              <span style={{ fontSize: 9, color: COLORS.green }}>{fmt(h)}</span>
                            </div>
                            <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, position: "relative" }}>
                              <div style={{
                                position: "absolute", left: `${Math.min(Math.max(((c - l) / (h - l)) * 100, 0), 100)}%`,
                                top: -2, width: 10, height: 10, borderRadius: 5, background: COLORS.purple,
                                transform: "translateX(-50%)", border: `2px solid ${COLORS.bg}`,
                              }} />
                              <div style={{ width: "100%", height: "100%", background: `linear-gradient(90deg, ${COLORS.red}33, ${COLORS.green}33)`, borderRadius: 3 }} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
                          <DataCell label="Open" value={fmt(o)} />
                          <DataCell label="Close" value={fmt(c)} color={barColor} />
                          <DataCell label="YCP" value={fmt(ycp)} />
                          <DataCell label="Volume" value={fmtK(selected.volume)} />
                          <DataCell label="Trades" value={fmtK(selected.trades || 0)} />
                          <DataCell label="Turnover" value={fmtK(selected.value || 0)} />
                        </div>

                        <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: "auto", borderTop: `1px solid ${COLORS.border}22`, paddingTop: 6 }}>
                          Live from DSE • Sun–Thu 10:00–14:30 BST
                        </div>
                      </div>
                    </div>
                  );
                })() : histLoading ? (
                  <LoadingSpinner text="Loading chart data..." />
                ) : chartData.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.textMuted, fontSize: 12 }}>
                    No chart data available for {selected.symbol}
                  </div>
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
            isDSE ? (
              <Panel>
                <PanelHeader icon={<TrendingUp size={14} color={COLORS.green} />} title="TRADING SUMMARY" subtitle={`${selected.symbol} — Dhaka Stock Exchange`} />
                <div style={{ padding: 16 }}>
                  <MiniTable
                    headers={["Metric", "Value"]}
                    rows={[
                      [<span style={{ color: COLORS.text }}>Last Traded Price</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>{fmt(selected.price)} BDT</span>],
                      [<span style={{ color: COLORS.text }}>Day Change</span>, <span style={{ color: selected.change >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>{selected.change >= 0 ? "+" : ""}{fmt(selected.change)} ({fmtPct(selected.changePercent)})</span>],
                      [<span style={{ color: COLORS.text }}>Day High</span>, <span style={{ color: COLORS.green, fontWeight: 600 }}>{fmt(selected.high)} BDT</span>],
                      [<span style={{ color: COLORS.text }}>Day Low</span>, <span style={{ color: COLORS.red, fontWeight: 600 }}>{fmt(selected.low)} BDT</span>],
                      [<span style={{ color: COLORS.text }}>Previous Close (YCP)</span>, <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(selected.prevClose)} BDT</span>],
                      [<span style={{ color: COLORS.text }}>Volume</span>, <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmtK(selected.volume)}</span>],
                      [<span style={{ color: COLORS.text }}>Total Trades</span>, <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmtK(selected.trades || 0)}</span>],
                      [<span style={{ color: COLORS.text }}>Turnover (BDT)</span>, <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmtK(selected.value || 0)}</span>],
                    ]}
                  />
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 12 }}>
                    Detailed financial statements for DSE securities are available at <a href="https://www.dsebd.org" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight }}>dsebd.org</a>
                  </div>
                </div>
              </Panel>
            ) : (
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
            )
          )}

          {tab === "ESTIMATES" && (
            <Panel>
              <PanelHeader icon={<Activity size={14} color={COLORS.cyan} />} title="ANALYST ESTIMATES" subtitle="Consensus recommendations" />
              {isDSE ? (
                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                    <DataCell label="LTP" value={`${fmt(selected.price)} BDT`} color={COLORS.gold} />
                    <DataCell label="YCP" value={`${fmt(selected.prevClose)} BDT`} />
                    <DataCell label="Day Change" value={`${selected.change >= 0 ? "+" : ""}${fmt(selected.change)}`} color={selected.change >= 0 ? COLORS.green : COLORS.red} />
                    <DataCell label="Change %" value={fmtPct(selected.changePercent)} color={selected.changePercent >= 0 ? COLORS.green : COLORS.red} />
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
                    Analyst coverage and consensus estimates for DSE-listed securities are not available through this terminal. For research reports and recommendations, visit <a href="https://www.dsebd.org" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight }}>dsebd.org</a> or your local brokerage platform.
                  </div>
                </div>
              ) : finLoading ? (
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
              {isDSE ? (
                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                    <DataCell label="LTP" value={`${fmt(selected.price)} BDT`} color={COLORS.gold} />
                    <DataCell label="Day High" value={`${fmt(selected.high)} BDT`} color={COLORS.green} />
                    <DataCell label="Day Low" value={`${fmt(selected.low)} BDT`} color={COLORS.red} />
                    <DataCell label="Volume" value={fmtK(selected.volume)} />
                    <DataCell label="Trades" value={fmtK(selected.trades || 0)} />
                    <DataCell label="Turnover" value={fmtK(selected.value || 0)} />
                    <DataCell label="YCP" value={`${fmt(selected.prevClose)} BDT`} />
                    <DataCell label="Spread" value={`${fmt(selected.high - selected.low)} BDT`} />
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>
                    P/E, P/B, and other valuation ratios for DSE securities are available at <a href="https://www.dsebd.org" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight }}>dsebd.org</a>
                  </div>
                </div>
              ) : finLoading ? (
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
              {isDSE ? (
                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <DataCell label="Trading Code" value={selected.symbol} color={COLORS.purpleLight} />
                    <DataCell label="Exchange" value="Dhaka Stock Exchange" />
                    <DataCell label="Currency" value="BDT (৳)" />
                    <DataCell label="Last Price" value={`${fmt(selected.price)} BDT`} color={COLORS.gold} />
                    <DataCell label="Market State" value={selected.marketState === "REGULAR" ? "OPEN" : "CLOSED"} color={selected.marketState === "REGULAR" ? COLORS.green : COLORS.orange} />
                    <DataCell label="Volume" value={fmtK(selected.volume)} />
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 12 }}>
                    <strong style={{ color: COLORS.text }}>{selected.name}</strong> is listed on the Dhaka Stock Exchange (DSE), the primary stock exchange of Bangladesh.
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
                    <strong style={{ color: COLORS.textMuted }}>Market Hours:</strong> Sunday–Thursday, 10:00 AM – 2:30 PM BST<br />
                    <strong style={{ color: COLORS.textMuted }}>Website:</strong>{" "}
                    <a href="https://www.dsebd.org" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight }}>dsebd.org</a>
                  </div>
                </div>
              ) : finLoading ? (
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
