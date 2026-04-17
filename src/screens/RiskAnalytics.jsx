import { useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Shield, Activity, PieChart as PieIcon } from "lucide-react";
import { fmt, fmtPct, fmtK } from "../config";
import { useColors } from "../ThemeContext";
import { useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, MiniTable } from "../shared";

export default function RiskAnalytics({ allStockQuotes }) {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const stocks = allStockQuotes || [];

  const returnData = useMemo(() => {
    if (!stocks.length) return [];
    return stocks
      .filter((s) => s.changePercent != null)
      .map((s) => ({ ret: parseFloat((s.changePercent || 0).toFixed(2)), name: s.symbol }));
  }, [stocks]);

  // NOTE: This is *cross-sectional* dispersion across today's returns of the watchlist,
  // NOT a time-series Value-at-Risk on a real portfolio. Labels reflect that.
  const { p5, p1, tailMean5, avgReturn, maxLoss, maxGain, stdDev } = useMemo(() => {
    if (!returnData.length) return { p5: 0, p1: 0, tailMean5: 0, avgReturn: 0, maxLoss: 0, maxGain: 0, stdDev: 0 };
    const sorted = [...returnData].sort((a, b) => a.ret - b.ret);
    const n = sorted.length;
    // 5th and 1st percentile — when n is small, 1st percentile collapses to the min,
    // so we clamp to at least index 1 so the metric is distinguishable from "max loss".
    const p5v = sorted[Math.max(0, Math.floor(n * 0.05))]?.ret || 0;
    const p1v = sorted[Math.min(n - 1, Math.max(1, Math.floor(n * 0.01)))]?.ret || 0;
    const tailCount = Math.max(1, Math.floor(n * 0.05));
    const tail = sorted.slice(0, tailCount);
    const tm5 = tail.reduce((a, v) => a + v.ret, 0) / tail.length;
    const avg = returnData.reduce((a, v) => a + v.ret, 0) / n;
    const ml = sorted[0]?.ret || 0;
    const mg = sorted[n - 1]?.ret || 0;
    // Sample variance (n-1) for an unbiased estimator.
    const variance = n > 1
      ? returnData.reduce((a, v) => a + Math.pow(v.ret - avg, 2), 0) / (n - 1)
      : 0;
    const sd = Math.sqrt(variance);
    return { p5: p5v, p1: p1v, tailMean5: tm5, avgReturn: avg, maxLoss: ml, maxGain: mg, stdDev: sd };
  }, [returnData]);

  // Illustrative scenario table — NOT a real stress test. Just scales today's dispersion
  // by the historical max-drawdown of each named event to give a rough order-of-magnitude.
  // When no live return data has arrived yet we render an em dash instead of "0.00%" so
  // the user doesn't see six rows of spurious zeros before the first poll lands.
  const stressTests = useMemo(() => {
    const hasData = returnData.length > 0;
    const currentAvg = avgReturn;
    const currentVol = stdDev;
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
      portfolioImpact: hasData ? fmt(currentAvg * s.multiplier - currentVol * s.multiplier, 2) + "%" : "\u2014",
      scaledTail: hasData ? fmt(Math.abs(p5) * s.multiplier, 2) + "%" : "\u2014",
      severity: s.multiplier >= 5 ? "EXTREME" : s.multiplier >= 3 ? "HIGH" : "MODERATE",
    }));
  }, [returnData.length, avgReturn, stdDev, p5]);

  const topRiskContributors = useMemo(() => {
    if (!stocks.length) return [];
    return [...stocks]
      .filter((s) => s.changePercent != null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 8)
      .map((s) => ({ symbol: s.symbol, name: s.name, change: s.changePercent, price: s.price, volume: s.volume, marketCap: s.marketCap }));
  }, [stocks]);

  const metricsGrid = isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr";
  const panelGrid = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div style={{ padding: isMobile ? 8 : 12 }}>
      {/* TOP METRICS — all labels reflect cross-sectional snapshot, NOT time-series VaR */}
      <div style={{ display: "grid", gridTemplateColumns: metricsGrid, gap: isMobile ? 6 : 10, marginBottom: 10 }}>
        {[
          { l: "5th %ile Return", v: fmt(Math.abs(p5)) + "%", c: COLORS.orange, s: "Cross-sectional today" },
          { l: "1st %ile Return", v: fmt(Math.abs(p1)) + "%", c: COLORS.red, s: "Cross-sectional today" },
          { l: "Tail Mean (≤5%)", v: fmt(Math.abs(tailMean5)) + "%", c: COLORS.red, s: "Avg of worst 5%" },
          { l: "Avg Return", v: fmtPct(avgReturn), c: avgReturn >= 0 ? COLORS.green : COLORS.red, s: "Cross-sectional mean" },
        ].map((m) => (
          <Panel key={m.l}>
            <div style={{ padding: isMobile ? 8 : 12, textAlign: "center" }}>
              <div style={{ fontSize: isMobile ? 9 : 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: m.c, fontFamily: "'JetBrains Mono',monospace" }}>{m.v}</div>
              <div style={{ fontSize: 9, color: COLORS.textDim }}>{m.s}</div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: panelGrid, gap: 10 }}>
        {/* RETURN DISTRIBUTION */}
        <Panel>
          <PanelHeader icon={<AlertTriangle size={14} color={COLORS.red} />} title="RETURN DISTRIBUTION" subtitle="Today's returns across watchlist" right={<Badge color={COLORS.green}>LIVE</Badge>} />
          <div style={{ padding: 8, height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={returnData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: COLORS.textMuted }} interval={Math.max(0, Math.floor(returnData.length / (isMobile ? 8 : 15)))} angle={-45} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} />
                <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                <Bar dataKey="ret" barSize={8}>
                  {returnData.map((d, i) => (
                    <Cell key={i} fill={d.ret < p5 ? COLORS.red : d.ret < 0 ? COLORS.orange + "88" : COLORS.green + "88"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* STRESS TESTS */}
        <Panel>
          <PanelHeader icon={<Shield size={14} color={COLORS.orange} />} title="ILLUSTRATIVE SCENARIOS" subtitle="Today's dispersion scaled by past event drawdowns — not a real stress test" />
          <div style={{ overflowX: "auto" }}>
            <MiniTable
              headers={isMobile ? ["Scenario", "Impact", "Severity"] : ["Scenario", "Est. Impact", "Scaled Tail", "Severity"]}
              rows={stressTests.map((s) => {
                const base = [
                  <div>
                    <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 10 }}>{s.scenario}</span>
                    {!isMobile && <div style={{ fontSize: 8, color: COLORS.textDim }}>{s.desc}</div>}
                  </div>,
                  <span style={{ color: COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>{s.portfolioImpact}</span>,
                ];
                if (!isMobile) base.push(<span style={{ color: COLORS.orange, fontFamily: "'JetBrains Mono',monospace" }}>{s.scaledTail}</span>);
                base.push(<Badge color={s.severity === "EXTREME" ? COLORS.red : s.severity === "HIGH" ? COLORS.orange : COLORS.gold}>{s.severity}</Badge>);
                return base;
              })}
            />
          </div>
        </Panel>

        {/* TOP RISK CONTRIBUTORS */}
        <Panel>
          <PanelHeader icon={<Activity size={14} color={COLORS.cyan} />} title="TOP RISK CONTRIBUTORS" subtitle="Biggest movers today" right={<Badge color={COLORS.green}>LIVE</Badge>} />
          <div style={{ padding: 8 }}>
            {topRiskContributors.map((s) => (
              <div key={s.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 4px", borderBottom: `1px solid ${COLORS.border}22` }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{s.symbol}</span>
                  {!isMobile && <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: 6 }}>{(s.name || "").slice(0, 16)}</span>}
                </div>
                <div style={{ display: "flex", gap: isMobile ? 6 : 12, alignItems: "center" }}>
                  {!isMobile && <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{fmtK(s.marketCap)}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.change >= 0 ? COLORS.green : COLORS.red, fontFamily: "'JetBrains Mono',monospace", minWidth: 50, textAlign: "right" }}>
                    {s.change >= 0 ? "+" : ""}{fmt(s.change)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* RISK METRICS */}
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
