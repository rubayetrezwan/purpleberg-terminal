import { useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Shield, Activity, PieChart as PieIcon } from "lucide-react";
import { COLORS, fmt, fmtPct } from "../config";
import { Panel, PanelHeader, MiniTable } from "../shared";

export default function RiskAnalytics({ allStockQuotes }) {
  const stocks = allStockQuotes || [];

  // Calculate real return distribution from stock data
  const returnData = useMemo(() => {
    if (!stocks.length) return [];
    return stocks
      .filter((s) => s.changePercent != null)
      .map((s, i) => ({
        day: i + 1,
        ret: parseFloat((s.changePercent || 0).toFixed(2)),
        name: s.symbol,
      }));
  }, [stocks]);

  // VaR calculations from actual stock returns
  const { var95, var99, cvar95, avgReturn, maxLoss, maxGain, stdDev } = useMemo(() => {
    if (!returnData.length) return { var95: 0, var99: 0, cvar95: 0, avgReturn: 0, maxLoss: 0, maxGain: 0, stdDev: 0 };
    const sorted = [...returnData].sort((a, b) => a.ret - b.ret);
    const v95 = sorted[Math.floor(sorted.length * 0.05)]?.ret || 0;
    const v99 = sorted[Math.floor(sorted.length * 0.01)]?.ret || 0;
    const tail = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.05)));
    const cv95 = tail.reduce((a, v) => a + v.ret, 0) / tail.length;
    const avg = returnData.reduce((a, v) => a + v.ret, 0) / returnData.length;
    const ml = sorted[0]?.ret || 0;
    const mg = sorted[sorted.length - 1]?.ret || 0;
    const variance = returnData.reduce((a, v) => a + Math.pow(v.ret - avg, 2), 0) / returnData.length;
    const sd = Math.sqrt(variance);
    return { var95: v95, var99: v99, cvar95: cv95, avgReturn: avg, maxLoss: ml, maxGain: mg, stdDev: sd };
  }, [returnData]);

  // Stress test scenarios (based on historical data)
  const stressTests = [
    { scenario: "2008 GFC", equity: -38.5, fi: 5.2, fx: -12.4, total: -28.1 },
    { scenario: "COVID-19 Crash", equity: -33.9, fi: 8.1, fx: -5.2, total: -22.4 },
    { scenario: "Dot-com Bust", equity: -45.2, fi: 12.4, fx: 2.1, total: -18.8 },
    { scenario: "Rate Shock +200bp", equity: -12.8, fi: -18.5, fx: -3.2, total: -14.2 },
    { scenario: "Oil Crisis", equity: -18.4, fi: 2.8, fx: -8.5, total: -12.8 },
    { scenario: "EM Currency Crisis", equity: -22.1, fi: -5.4, fx: -15.8, total: -18.4 },
  ];

  // Risk budget from actual portfolio composition
  const riskBudget = useMemo(() => {
    if (!stocks.length) return [];
    const exchangeGroups = {};
    stocks.forEach((s) => {
      const key = s.exchange || "Other";
      exchangeGroups[key] = (exchangeGroups[key] || 0) + 1;
    });
    return Object.entries(exchangeGroups)
      .map(([name, count]) => ({ name, value: Math.round((count / stocks.length) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stocks]);

  const riskColors = [COLORS.purple, COLORS.blue, COLORS.orange, COLORS.green, COLORS.gold, COLORS.cyan];

  return (
    <div style={{ padding: 12 }}>
      {/* TOP METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { l: "VaR (95%)", v: fmt(Math.abs(var95)) + "%", c: COLORS.orange, s: "Cross-sectional" },
          { l: "VaR (99%)", v: fmt(Math.abs(var99)) + "%", c: COLORS.red, s: "Cross-sectional" },
          { l: "CVaR (95%)", v: fmt(Math.abs(cvar95)) + "%", c: COLORS.red, s: "Expected Shortfall" },
          { l: "Avg Return", v: fmtPct(avgReturn), c: avgReturn >= 0 ? COLORS.green : COLORS.red, s: "Cross-sectional mean" },
        ].map((m) => (
          <Panel key={m.l}>
            <div style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.c, fontFamily: "'JetBrains Mono',monospace" }}>{m.v}</div>
              <div style={{ fontSize: 9, color: COLORS.textDim }}>{m.s}</div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* RETURN DISTRIBUTION */}
        <Panel>
          <PanelHeader icon={<AlertTriangle size={14} color={COLORS.red} />} title="RETURN DISTRIBUTION" subtitle="Today's returns across holdings" />
          <div style={{ padding: 8, height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={returnData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: COLORS.textMuted }} interval={Math.max(0, Math.floor(returnData.length / 15))} angle={-45} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} />
                <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                <Bar dataKey="ret" barSize={8}>
                  {returnData.map((d, i) => (
                    <Cell key={i} fill={d.ret < var95 ? COLORS.red : d.ret < 0 ? COLORS.orange + "88" : COLORS.green + "88"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* STRESS TESTS */}
        <Panel>
          <PanelHeader icon={<Shield size={14} color={COLORS.orange} />} title="STRESS TEST SCENARIOS" subtitle="Historical & hypothetical" />
          <MiniTable
            headers={["Scenario", "Equity", "Fixed Inc", "FX", "Total"]}
            rows={stressTests.map((s) => [
              <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 10 }}>{s.scenario}</span>,
              <span style={{ color: s.equity < 0 ? COLORS.red : COLORS.green }}>{fmtPct(s.equity)}</span>,
              <span style={{ color: s.fi < 0 ? COLORS.red : COLORS.green }}>{fmtPct(s.fi)}</span>,
              <span style={{ color: s.fx < 0 ? COLORS.red : COLORS.green }}>{fmtPct(s.fx)}</span>,
              <span style={{ color: COLORS.red, fontWeight: 700 }}>{fmtPct(s.total)}</span>,
            ])}
          />
        </Panel>

        {/* EXCHANGE DISTRIBUTION */}
        <Panel>
          <PanelHeader icon={<PieIcon size={14} color={COLORS.purple} />} title="EXCHANGE DISTRIBUTION" />
          <div style={{ padding: 8, height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={riskBudget} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                  {riskBudget.map((_, i) => <Cell key={i} fill={riskColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* RISK METRICS */}
        <Panel>
          <PanelHeader icon={<Activity size={14} color={COLORS.cyan} />} title="RISK METRICS" />
          <div style={{ padding: 12 }}>
            {[
              { l: "Max Loss Today", v: fmtPct(maxLoss), c: COLORS.red },
              { l: "Max Gain Today", v: fmtPct(maxGain), c: COLORS.green },
              { l: "Std Deviation", v: fmt(stdDev) + "%", c: COLORS.orange },
              { l: "Avg Return", v: fmtPct(avgReturn), c: avgReturn >= 0 ? COLORS.green : COLORS.red },
              { l: "Positive %", v: fmt(returnData.filter((d) => d.ret >= 0).length / Math.max(returnData.length, 1) * 100, 0) + "%", c: COLORS.green },
              { l: "Negative %", v: fmt(returnData.filter((d) => d.ret < 0).length / Math.max(returnData.length, 1) * 100, 0) + "%", c: COLORS.red },
              { l: "Total Securities", v: returnData.length.toString(), c: COLORS.text },
            ].map((m) => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${COLORS.border}22` }}>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{m.l}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: m.c, fontFamily: "'JetBrains Mono',monospace" }}>{m.v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
