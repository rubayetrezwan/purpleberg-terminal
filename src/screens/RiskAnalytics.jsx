import { useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Shield, Activity, PieChart as PieIcon } from "lucide-react";
import { fmt, fmtPct, fmtK } from "../config";
import { useColors } from "../ThemeContext";
import { Panel, PanelHeader, Badge, MiniTable } from "../shared";

export default function RiskAnalytics({ allStockQuotes }) {
  const COLORS = useColors();
  const stocks = allStockQuotes || [];

  // Calculate real return distribution from stock data
  const returnData = useMemo(() => {
    if (!stocks.length) return [];
    return stocks
      .filter((s) => s.changePercent != null)
      .map((s) => ({
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

  // Stress test: apply real multipliers to today's actual portfolio metrics
  const stressTests = useMemo(() => {
    const currentAvg = avgReturn;
    const currentVol = stdDev;
    // Scale today's observed cross-sectional volatility by historical crisis multipliers
    return [
      { scenario: "2008 GFC (-56% SPX)", multiplier: 8.5, desc: "Lehman-scale systemic shock" },
      { scenario: "COVID-19 Crash (-34%)", multiplier: 5.0, desc: "Pandemic liquidity crisis" },
      { scenario: "Dot-com Bust (-49%)", multiplier: 7.0, desc: "Tech valuation collapse" },
      { scenario: "Rate Shock +200bp", multiplier: 3.5, desc: "Aggressive Fed tightening" },
      { scenario: "Flash Crash (-9%)", multiplier: 2.0, desc: "Algo-driven sell-off" },
      { scenario: "Mild Correction (-10%)", multiplier: 1.5, desc: "Routine market pullback" },
    ].map((s) => ({
      scenario: s.scenario,
      desc: s.desc,
      portfolioImpact: fmt(currentAvg * s.multiplier - currentVol * s.multiplier, 2) + "%",
      estimatedVaR: fmt(Math.abs(var95) * s.multiplier, 2) + "%",
      severity: s.multiplier >= 5 ? "EXTREME" : s.multiplier >= 3 ? "HIGH" : "MODERATE",
    }));
  }, [avgReturn, stdDev, var95]);

  // Sector distribution from actual stock data
  const sectorData = useMemo(() => {
    if (!stocks.length) return [];
    const sectors = {};
    stocks.forEach((s) => {
      const key = s.exchange || "Other";
      sectors[key] = (sectors[key] || 0) + 1;
    });
    return Object.entries(sectors)
      .map(([name, count]) => ({ name, value: Math.round((count / stocks.length) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stocks]);

  // Top risk contributors — stocks with biggest absolute moves
  const topRiskContributors = useMemo(() => {
    if (!stocks.length) return [];
    return [...stocks]
      .filter((s) => s.changePercent != null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 8)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        change: s.changePercent,
        price: s.price,
        volume: s.volume,
        marketCap: s.marketCap,
      }));
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
          <PanelHeader icon={<AlertTriangle size={14} color={COLORS.red} />} title="RETURN DISTRIBUTION" subtitle="Today's returns across holdings" right={<Badge color={COLORS.green}>LIVE</Badge>} />
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
          <PanelHeader icon={<Shield size={14} color={COLORS.orange} />} title="STRESS TEST SCENARIOS" subtitle="Based on today's portfolio volatility" />
          <MiniTable
            headers={["Scenario", "Est. Portfolio Impact", "Scaled VaR", "Severity"]}
            rows={stressTests.map((s) => [
              <div>
                <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 10 }}>{s.scenario}</span>
                <div style={{ fontSize: 8, color: COLORS.textDim }}>{s.desc}</div>
              </div>,
              <span style={{ color: COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>{s.portfolioImpact}</span>,
              <span style={{ color: COLORS.orange, fontFamily: "'JetBrains Mono',monospace" }}>{s.estimatedVaR}</span>,
              <Badge color={s.severity === "EXTREME" ? COLORS.red : s.severity === "HIGH" ? COLORS.orange : COLORS.gold}>{s.severity}</Badge>,
            ])}
          />
        </Panel>

        {/* TOP RISK CONTRIBUTORS */}
        <Panel>
          <PanelHeader icon={<Activity size={14} color={COLORS.cyan} />} title="TOP RISK CONTRIBUTORS" subtitle="Biggest movers today" right={<Badge color={COLORS.green}>LIVE</Badge>} />
          <div style={{ padding: 8 }}>
            {topRiskContributors.map((s) => (
              <div key={s.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 4px", borderBottom: `1px solid ${COLORS.border}22` }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{s.symbol}</span>
                  <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: 6 }}>{(s.name || "").slice(0, 16)}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{fmtK(s.marketCap)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.change >= 0 ? COLORS.green : COLORS.red, fontFamily: "'JetBrains Mono',monospace", minWidth: 50, textAlign: "right" }}>
                    {s.change >= 0 ? "+" : ""}{fmt(s.change)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* RISK METRICS + DISTRIBUTION */}
        <Panel>
          <PanelHeader icon={<PieIcon size={14} color={COLORS.purple} />} title="RISK METRICS" right={<Badge color={COLORS.green}>LIVE</Badge>} />
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
