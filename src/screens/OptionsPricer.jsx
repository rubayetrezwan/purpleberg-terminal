import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, TrendingUp, Hash } from "lucide-react";
import { fmt } from "../config";
import { useColors } from "../ThemeContext";
import { useIsMobile } from "../hooks";
import { api } from "../api";
import { Panel, PanelHeader, DataCell, MiniTable } from "../shared";

export default function OptionsPricer() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const [spot, setSpot] = useState("");
  const [strike, setStrike] = useState("");
  const [vol, setVol] = useState("25");
  const [rate, setRate] = useState("5.25");
  const [time, setTime] = useState("30");
  const [optType, setOptType] = useState("call");

  // Fetch live AAPL price on mount
  useEffect(() => {
    api.quotes(["AAPL"]).then((data) => {
      if (data?.[0]?.price) {
        const p = data[0].price.toFixed(2);
        setSpot(p);
        setStrike(Math.round(data[0].price).toString());
      }
    }).catch(() => {
      setSpot("250");
      setStrike("255");
    });
  }, []);

  // Black-Scholes pricing
  const bs = useMemo(() => {
    const S = parseFloat(spot || 0),
      K = parseFloat(strike || 0),
      v = parseFloat(vol || 0) / 100,
      r = parseFloat(rate || 0) / 100,
      T = parseFloat(time || 0) / 365;
    if (!S || !K || !v || !T) return null;

    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    const N = (x) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1 / (1 + p * x);
      const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1 + sign * y);
    };

    const Nd1 = N(d1), Nd2 = N(d2), Nmd1 = N(-d1), Nmd2 = N(-d2);
    const callP = S * Nd1 - K * Math.exp(-r * T) * Nd2;
    const putP = K * Math.exp(-r * T) * Nmd2 - S * Nmd1;
    const price = optType === "call" ? callP : putP;
    const delta = optType === "call" ? Nd1 : Nd1 - 1;
    const gamma = Math.exp((-d1 * d1) / 2) / Math.sqrt(2 * Math.PI) / (S * v * Math.sqrt(T));
    const theta = (-(S * v * Math.exp((-d1 * d1) / 2)) / Math.sqrt(2 * Math.PI) / (2 * Math.sqrt(T))) / 365;
    const vega = (S * Math.sqrt(T) * Math.exp((-d1 * d1) / 2)) / Math.sqrt(2 * Math.PI) / 100;
    const rho = optType === "call"
      ? K * T * Math.exp(-r * T) * Nd2 / 100
      : -K * T * Math.exp(-r * T) * Nmd2 / 100;

    return { price, delta, gamma, theta, vega, rho };
  }, [spot, strike, vol, rate, time, optType]);

  // P&L diagram
  const plData = useMemo(() => {
    if (!bs) return [];
    const S = parseFloat(spot), K = parseFloat(strike);
    return Array.from({ length: 41 }, (_, i) => {
      const px = S * 0.8 + (S * 0.4 * i) / 40;
      const pl = optType === "call" ? Math.max(0, px - K) - bs.price : Math.max(0, K - px) - bs.price;
      return { price: parseFloat(px.toFixed(1)), pnl: parseFloat(pl.toFixed(2)) };
    });
  }, [bs, spot, strike, optType]);

  // Option chain (calculated from BS for different strikes)
  const chainData = useMemo(() => {
    const S = parseFloat(spot || 0),
      v = parseFloat(vol || 0) / 100,
      r = parseFloat(rate || 0) / 100,
      T = parseFloat(time || 0) / 365;
    if (!S || !v || !T) return [];

    const N = (x) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1 / (1 + p * x);
      const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1 + sign * y);
    };

    return Array.from({ length: 9 }, (_, i) => {
      const K = Math.round(S * 0.9 + (S * 0.2 * i) / 8);
      const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
      const d2 = d1 - v * Math.sqrt(T);
      const callP = S * N(d1) - K * Math.exp(-r * T) * N(d2);
      const putP = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
      const callDelta = N(d1);
      const putDelta = N(d1) - 1;
      return { strike: K, callPrice: callP, putPrice: putP, callDelta, putDelta };
    });
  }, [spot, vol, rate, time]);

  const InputField = ({ label, val, set, suffix }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          value={val}
          onChange={(e) => set(e.target.value)}
          style={{
            width: "100%", padding: "6px 8px", background: COLORS.bgInput,
            border: `1px solid ${COLORS.border}`, borderRadius: 3,
            color: COLORS.text, fontSize: 12,
            fontFamily: "'JetBrains Mono',monospace", outline: "none",
            boxSizing: "border-box",
          }}
        />
        {suffix && <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? 8 : 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr", gap: 10 }}>
      <Panel>
        <PanelHeader icon={<Activity size={14} color={COLORS.orange} />} title="OPTION PRICER" subtitle="Black-Scholes Model" />
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {["call", "put"].map((t) => (
              <button
                key={t}
                onClick={() => setOptType(t)}
                style={{
                  flex: 1, padding: 6, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${optType === t ? COLORS.purple : COLORS.border}`,
                  borderRadius: 3, cursor: "pointer", textTransform: "uppercase",
                  background: optType === t ? COLORS.purpleDim + "66" : "transparent",
                  color: optType === t ? (t === "call" ? COLORS.green : COLORS.red) : COLORS.textMuted,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <InputField label="SPOT PRICE ($)" val={spot} set={setSpot} />
          <InputField label="STRIKE PRICE ($)" val={strike} set={setStrike} />
          <InputField label="VOLATILITY" val={vol} set={setVol} suffix="%" />
          <InputField label="RISK-FREE RATE" val={rate} set={setRate} suffix="%" />
          <InputField label="DAYS TO EXPIRY" val={time} set={setTime} suffix="D" />
        </div>
        {bs && (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted }}>OPTION PRICE</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.gold, fontFamily: "'JetBrains Mono',monospace" }}>
                ${fmt(bs.price)}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <DataCell label="Delta" value={fmt(bs.delta, 4)} color={bs.delta >= 0 ? COLORS.green : COLORS.red} />
              <DataCell label="Gamma" value={fmt(bs.gamma, 4)} />
              <DataCell label="Theta" value={fmt(bs.theta, 4)} color={COLORS.red} />
              <DataCell label="Vega" value={fmt(bs.vega, 4)} color={COLORS.blue} />
              <DataCell label="Rho" value={fmt(bs.rho, 4)} color={COLORS.cyan} />
            </div>
          </div>
        )}
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Panel>
          <PanelHeader icon={<TrendingUp size={14} color={COLORS.green} />} title="PAYOFF DIAGRAM" subtitle="P&L at expiration" />
          <div style={{ padding: 8, height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={plData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + "44"} />
                <XAxis dataKey="price" tick={{ fontSize: 9, fill: COLORS.textMuted }} label={{ value: "Stock Price", position: "insideBottom", offset: -2, fontSize: 10, fill: COLORS.textMuted }} />
                <YAxis tick={{ fontSize: 9, fill: COLORS.textMuted }} label={{ value: "P&L ($)", angle: -90, position: "insideLeft", fontSize: 10, fill: COLORS.textMuted }} />
                <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                <defs>
                  <linearGradient id="plg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="pnl" stroke={optType === "call" ? COLORS.green : COLORS.red} fill="url(#plg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={<Hash size={14} color={COLORS.cyan} />} title="OPTION CHAIN" subtitle="Calculated prices (Black-Scholes)" />
          <MiniTable
            headers={["Strike", "Call $", "Call Δ", "Put $", "Put Δ"]}
            rows={chainData.map((c) => [
              <span style={{ fontWeight: 700, color: COLORS.text }}>{c.strike}</span>,
              <span style={{ color: COLORS.green }}>{fmt(c.callPrice)}</span>,
              <span style={{ color: COLORS.textDim }}>{fmt(c.callDelta, 3)}</span>,
              <span style={{ color: COLORS.red }}>{fmt(c.putPrice)}</span>,
              <span style={{ color: COLORS.textDim }}>{fmt(c.putDelta, 3)}</span>,
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}
