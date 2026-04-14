import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Landmark, Globe, Shield } from "lucide-react";
import { BOND_SYMBOLS, fmt } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, useIsMobile } from "../hooks";
import { Panel, PanelHeader, ChgVal, MiniTable, LoadingSpinner } from "../shared";

export default function FixedIncome() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const bondSymbols = useMemo(() => BOND_SYMBOLS.map((b) => b.symbol), []);
  const { data: bondQuotes, loading } = useQuotes(bondSymbols, 15000);

  // Build yield curve data from real treasury yields
  const yieldCurve = useMemo(() => {
    const tenors = [
      { tenor: "3M", symbol: "^IRX", divisor: 1 },
      { tenor: "5Y", symbol: "^FVX", divisor: 1 },
      { tenor: "10Y", symbol: "^TNX", divisor: 1 },
      { tenor: "30Y", symbol: "^TYX", divisor: 1 },
    ];
    return tenors.map((t) => {
      const q = bondQuotes.find((d) => d.symbol === t.symbol);
      return { tenor: t.tenor, yield_val: q?.price ? q.price / t.divisor : 0 };
    }).filter((d) => d.yield_val > 0);
  }, [bondQuotes]);

  const bonds = BOND_SYMBOLS.map((b) => {
    const q = bondQuotes.find((d) => d.symbol === b.symbol);
    return {
      ...b,
      yield_val: q?.price ?? 0,
      // Yahoo returns the yield change in percentage points (e.g. 0.02 = 2bp).
      // Scale up so the "bp" suffix in ChgVal renders correct basis points.
      chgBps: (q?.change ?? 0) * 100,
    };
  });

  return (
    <div style={{ padding: isMobile ? 8 : 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
      {/* YIELD CURVE */}
      <Panel style={{ gridColumn: isMobile ? "1" : "1/3" }}>
        <PanelHeader
          icon={<Landmark size={14} color={COLORS.blue} />}
          title="US TREASURY YIELD CURVE"
          subtitle="Real-time yield curve from market data"
        />
        <div style={{ padding: 8, height: 280 }}>
          {loading ? (
            <LoadingSpinner text="Loading yield curve..." />
          ) : (
            <ResponsiveContainer>
              <AreaChart data={yieldCurve}>
                <defs>
                  <linearGradient id="yg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                <XAxis dataKey="tenor" tick={{ fontSize: 10, fill: COLORS.textMuted }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.textMuted }} domain={[0, "auto"]} />
                <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                <Area type="monotone" dataKey="yield_val" stroke={COLORS.gold} fill="url(#yg)" strokeWidth={2} name="Yield %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      {/* BOND MONITOR */}
      <Panel>
        <PanelHeader
          icon={<Globe size={14} color={COLORS.cyan} />}
          title="TREASURY MONITOR"
          subtitle="US Government bond yields"
        />
        <MiniTable
          headers={["Bond", "Yield", "Change"]}
          rows={bonds.map((b) => [
            <span style={{ color: COLORS.text }}>{b.name}</span>,
            <span style={{ color: COLORS.gold, fontWeight: 600 }}>{fmt(b.yield_val)}%</span>,
            <ChgVal val={b.chgBps} suffix="bp" />,
          ])}
        />
      </Panel>

      {/* YIELD ANALYSIS */}
      <Panel>
        <PanelHeader
          icon={<Shield size={14} color={COLORS.orange} />}
          title="YIELD SPREAD ANALYSIS"
          subtitle="Key fixed income metrics"
        />
        <div style={{ padding: 12 }}>
          {(() => {
            const y3m = bondQuotes.find((d) => d.symbol === "^IRX")?.price || 0;
            const y10 = bondQuotes.find((d) => d.symbol === "^TNX")?.price || 0;
            const y30 = bondQuotes.find((d) => d.symbol === "^TYX")?.price || 0;
            const y5 = bondQuotes.find((d) => d.symbol === "^FVX")?.price || 0;

            const items = [
              { l: "3M T-Bill Yield", v: `${fmt(y3m)}%` },
              { l: "5Y Treasury Yield", v: `${fmt(y5)}%` },
              { l: "10Y Treasury Yield", v: `${fmt(y10)}%` },
              { l: "30Y Treasury Yield", v: `${fmt(y30)}%` },
              { l: "10Y-3M Spread", v: `${fmt((y10 - y3m) * 100, 0)} bps` },
              { l: "30Y-10Y Spread", v: `${fmt((y30 - y10) * 100, 0)} bps` },
              { l: "Curve Shape", v: y10 > y3m ? "Normal" : "Inverted" },
            ];
            return items.map((item) => (
              <div
                key={item.l}
                style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "4px 0", borderBottom: `1px solid ${COLORS.border}22`,
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{item.l}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>{item.v}</span>
              </div>
            ));
          })()}
        </div>
      </Panel>
    </div>
  );
}
