import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, AreaChart, Area, Tooltip, ResponsiveContainer,
} from "recharts";
import { Briefcase, TrendingUp, PieChart as PieIcon, Plus, Trash2 } from "lucide-react";
import { fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, usePortfolio, useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, MiniTable, LoadingSpinner } from "../shared";

export default function PortfolioManager() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const { holdings, addHolding, removeHolding } = usePortfolio();
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newShares, setNewShares] = useState("");
  const [newCost, setNewCost] = useState("");

  // Fetch live prices for all holdings
  const holdingSymbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { data: liveQuotes, loading } = useQuotes(holdingSymbols, 15000);

  // Enrich holdings with live data.
  // IMPORTANT: when a quote is missing we do NOT silently fall back to avg cost —
  // that would show P&L as 0% and mask data-fetch failures. Instead mark `stale:true`
  // and use cost basis only for aggregation so the total isn't distorted to N/A.
  const enriched = useMemo(() => {
    return holdings.map((h) => {
      const q = liveQuotes.find((d) => d.symbol === h.symbol);
      const hasLive = q?.price != null && q.price > 0;
      const currentPrice = hasLive ? q.price : null;
      const mktValue = hasLive ? currentPrice * h.shares : h.avgCost * h.shares;
      const costBasis = h.avgCost * h.shares;
      const pnl = hasLive ? mktValue - costBasis : 0;
      const pnlPct = hasLive && costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return {
        ...h,
        currentPrice,
        hasLive,
        mktValue,
        costBasis,
        pnl,
        pnlPct,
        name: q?.name || h.name || h.symbol,
        changePercent: hasLive ? (q?.changePercent || 0) : null,
      };
    });
  }, [holdings, liveQuotes]);

  // Aggregate only over rows that have live data so the header numbers don't
  // misrepresent a partial fetch as "flat P&L".
  const liveRows = enriched.filter((h) => h.hasLive);
  const totalValue = liveRows.reduce((a, h) => a + h.mktValue, 0);
  const totalCost = liveRows.reduce((a, h) => a + h.costBasis, 0);
  const totalPnL = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const staleCount = enriched.length - liveRows.length;

  // Allocation only over holdings with live prices, to avoid giving stale rows
  // a share of the pie based on their cost basis.
  const pieData = useMemo(() => {
    if (!liveRows.length || totalValue <= 0) return [];
    return liveRows.map((h) => ({
      name: h.symbol,
      value: parseFloat(((h.mktValue / totalValue) * 100).toFixed(1)),
    }));
  }, [liveRows, totalValue]);

  const pieColors = [COLORS.purple, COLORS.green, COLORS.blue, COLORS.orange, COLORS.cyan, COLORS.gold, COLORS.red, COLORS.purpleLight];

  const handleAdd = () => {
    const sym = newSymbol.trim().toUpperCase();
    const shares = parseFloat(newShares);
    const cost = parseFloat(newCost);
    if (!sym || !shares || !cost || shares <= 0 || cost <= 0) return;
    addHolding(sym, sym, shares, cost);
    setNewSymbol("");
    setNewShares("");
    setNewCost("");
    setShowAdd(false);
  };

  return (
    <div style={{ padding: isMobile ? 8 : 12 }}>
      {/* SUMMARY CARDS — When every holding is stale (no live quote), the P&L
          and return aggregates mean nothing, so we show an em dash rather than
          a misleading +0.00% green. */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 6 : 10, marginBottom: 10 }}>
        {[
          { l: "Portfolio Value", v: liveRows.length ? "$" + fmtK(totalValue) : "\u2014", c: COLORS.gold },
          { l: "Total P&L", v: liveRows.length ? (totalPnL >= 0 ? "+$" : "-$") + fmtK(Math.abs(totalPnL)) : "\u2014", c: !liveRows.length ? COLORS.textMuted : totalPnL >= 0 ? COLORS.green : COLORS.red },
          { l: "Return", v: liveRows.length ? fmtPct(totalReturn) : "\u2014", c: !liveRows.length ? COLORS.textMuted : totalReturn >= 0 ? COLORS.green : COLORS.red },
          { l: "# Holdings", v: holdings.length.toString(), c: COLORS.purple },
        ].map((m) => (
          <Panel key={m.l}>
            <div style={{ padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>{m.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.c, fontFamily: "'JetBrains Mono',monospace" }}>{m.v}</div>
            </div>
          </Panel>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 10 }}>
        {/* HOLDINGS TABLE */}
        <Panel>
          <PanelHeader
            icon={<Briefcase size={14} color={COLORS.purple} />}
            title="HOLDINGS"
            subtitle={staleCount > 0 ? `${staleCount} stale — no live quote` : "Portfolio positions with live P&L"}
            right={
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", fontSize: 10, fontWeight: 600,
                  background: COLORS.purple, color: COLORS.white,
                  border: "none", borderRadius: 3, cursor: "pointer",
                }}
              >
                <Plus size={12} /> ADD
              </button>
            }
          />

          {/* ADD FORM */}
          {showAdd && (
            <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: isMobile ? "1 1 45%" : "0 0 auto" }}>
                <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 2 }}>SYMBOL</div>
                <input
                  value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)}
                  placeholder="AAPL"
                  style={{ width: isMobile ? "100%" : 80, padding: "6px 8px", background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 3, color: COLORS.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: isMobile ? "1 1 45%" : "0 0 auto" }}>
                <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 2 }}>SHARES</div>
                <input
                  value={newShares} onChange={(e) => setNewShares(e.target.value)}
                  placeholder="100" type="number"
                  style={{ width: isMobile ? "100%" : 70, padding: "6px 8px", background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 3, color: COLORS.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: isMobile ? "1 1 45%" : "0 0 auto" }}>
                <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 2 }}>AVG COST ($)</div>
                <input
                  value={newCost} onChange={(e) => setNewCost(e.target.value)}
                  placeholder="150.00" type="number" step="0.01"
                  style={{ width: isMobile ? "100%" : 80, padding: "6px 8px", background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 3, color: COLORS.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button
                onClick={handleAdd}
                style={{ padding: "6px 14px", background: COLORS.green, color: COLORS.white, border: "none", borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 600, minHeight: 36 }}
              >
                Add
              </button>
            </div>
          )}

          {holdings.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
              No holdings yet. Click ADD to build your portfolio.
            </div>
          ) : loading && !enriched.length ? (
            <LoadingSpinner text="Loading portfolio..." />
          ) : (
            <MiniTable
              headers={["Symbol", "Name", "Shares", "Avg Cost", "Last", "Mkt Value", "P&L %", ""]}
              rows={enriched.map((h) => [
                <span style={{ color: COLORS.purpleLight, fontWeight: 700 }}>{h.symbol}</span>,
                <span style={{ color: COLORS.textDim, fontSize: 10, textAlign: "left" }}>{(h.name || "").slice(0, 16)}</span>,
                <span style={{ color: COLORS.text }}>{h.shares}</span>,
                <span style={{ color: COLORS.textDim }}>{fmt(h.avgCost)}</span>,
                h.hasLive
                  ? <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(h.currentPrice)}</span>
                  : <span title="No live quote" style={{ color: COLORS.textMuted, fontStyle: "italic" }}>—</span>,
                h.hasLive
                  ? <span style={{ color: COLORS.text }}>{fmtK(h.mktValue)}</span>
                  : <span style={{ color: COLORS.textMuted }}>—</span>,
                h.hasLive
                  ? <ChgVal val={h.pnlPct} />
                  : <span style={{ color: COLORS.textMuted }}>—</span>,
                <Trash2
                  size={12}
                  color={COLORS.red}
                  style={{ cursor: "pointer", opacity: 0.6 }}
                  onClick={() => removeHolding(h.symbol)}
                />,
              ])}
            />
          )}
        </Panel>

        {/* ALLOCATION + DAILY PERFORMANCE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Panel>
            <PanelHeader icon={<PieIcon size={14} color={COLORS.orange} />} title="ALLOCATION" subtitle="Portfolio breakdown" />
            {pieData.length > 0 ? (
              <>
                <div style={{ padding: 8, height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ padding: "0 8px 8px" }}>
                  {pieData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: COLORS.textDim, marginBottom: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: pieColors[i % pieColors.length] }} />
                      {d.name}: {d.value}%
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textMuted, fontSize: 11 }}>
                Add holdings to see allocation
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader icon={<TrendingUp size={14} color={COLORS.green} />} title="TODAY'S MOVERS" subtitle="Daily change by holding" />
            <div style={{ padding: 8 }}>
              {liveRows
                .slice()
                .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
                .slice(0, 8)
                .map((h) => (
                  <div key={h.symbol} style={{ display: "flex", justifyContent: "space-between", padding: "3px 4px", borderBottom: `1px solid ${COLORS.border}22` }}>
                    <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 600 }}>{h.symbol}</span>
                    <ChgVal val={h.changePercent} />
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
