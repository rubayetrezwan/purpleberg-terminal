import { useMemo } from "react";
import {
  Globe, BarChart3, Zap, Layers, Hash, Landmark,
} from "lucide-react";
import { INDEX_SYMBOLS, COMMODITY_SYMBOLS, BOND_SYMBOLS, fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge, ChgVal, MiniTable, LoadingSpinner } from "../shared";

export default function MarketDashboard({ allStockQuotes, news }) {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const isTablet = useIsMobile(1024);

  const indexSymbols = useMemo(() => INDEX_SYMBOLS.map((i) => i.symbol), []);
  const commoditySymbols = useMemo(() => COMMODITY_SYMBOLS.map((c) => c.symbol), []);
  const bondSymbols = useMemo(() => BOND_SYMBOLS.map((b) => b.symbol), []);

  const { data: indexQuotes, loading: idxLoading } = useQuotes(indexSymbols, 15000);
  const { data: commodityQuotes } = useQuotes(commoditySymbols, 30000);
  const { data: bondQuotes } = useQuotes(bondSymbols, 60000);

  const indices = INDEX_SYMBOLS.map((idx) => {
    const q = indexQuotes.find((d) => d.symbol === idx.symbol);
    return { sym: idx.short, name: idx.name, val: q?.price ?? 0, chg: q?.changePercent ?? 0 };
  });

  const topMovers = useMemo(() => {
    if (!allStockQuotes?.length) return [];
    const sorted = [...allStockQuotes]
      .filter((q) => q.changePercent != null && q.price > 0)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const gainers = sorted.filter((q) => q.changePercent > 0).slice(0, 6);
    const losers = sorted.filter((q) => q.changePercent < 0).slice(0, 5);
    return [...gainers, ...losers]
      .sort((a, b) => b.changePercent - a.changePercent)
      .map((q) => ({ name: q.symbol, val: q.changePercent || 0 }));
  }, [allStockQuotes]);

  const treemapData = useMemo(() => {
    if (!allStockQuotes?.length) return [];
    return [...allStockQuotes]
      .filter((q) => q.price > 0)
      .sort((a, b) => (b.marketCap || b.volume * b.price) - (a.marketCap || a.volume * a.price))
      .slice(0, 16)
      .map((q) => ({ name: q.symbol, size: q.marketCap, chg: q.changePercent || 0 }));
  }, [allStockQuotes]);

  const commodities = COMMODITY_SYMBOLS.map((c) => {
    const q = commodityQuotes.find((d) => d.symbol === c.symbol);
    return { ...c, price: q?.price ?? 0, chg: q?.changePercent ?? 0 };
  });

  const bonds = BOND_SYMBOLS.map((b) => {
    const q = bondQuotes.find((d) => d.symbol === b.symbol);
    // Yahoo returns the raw yield change in percentage points (e.g. 0.02 = 2bp).
    // Convert to basis points so the "bp" suffix in ChgVal is accurate.
    return { ...b, yield_val: q?.price ?? 0, chgBps: (q?.change ?? 0) * 100, priceVal: q?.prevClose ?? 0 };
  });

  const newsItems = (news || []).slice(0, 10);

  const mainGrid = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const idxGrid = isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(3, 1fr)" : "repeat(5, 1fr)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: mainGrid, gap: 10, padding: isMobile ? 8 : 10 }}>
      {/* INDICES */}
      <Panel style={{ gridColumn: isMobile ? "1" : isTablet ? "1/3" : "1/-1" }}>
        <PanelHeader
          icon={<Globe size={14} color={COLORS.purple} />}
          title="WORLD EQUITY INDICES"
          subtitle="Real-time global market overview"
          right={<Badge color={COLORS.green}>LIVE</Badge>}
        />
        {idxLoading ? (
          <LoadingSpinner text="Fetching global indices..." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: idxGrid, gap: 0 }}>
            {indices.map((idx, i) => (
              <div
                key={idx.sym}
                style={{
                  padding: isMobile ? "8px 10px" : "10px 12px",
                  borderRight: `1px solid ${COLORS.border}22`,
                  borderBottom: `1px solid ${COLORS.border}22`,
                }}
              >
                <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>{idx.sym}</div>
                <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 2 }}>{idx.name}</div>
                <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>
                  {idx.val === 0 ? "--" : idx.val > 10000 ? fmt(idx.val, 0) : fmt(idx.val, 2)}
                </div>
                <ChgVal val={idx.chg} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* TOP MOVERS */}
      <Panel>
        <PanelHeader icon={<BarChart3 size={14} color={COLORS.orange} />} title="TOP MOVERS" subtitle="Biggest price changes today" />
        <div style={{ padding: 8 }}>
          {!allStockQuotes?.length ? (
            <LoadingSpinner text="Loading movers..." />
          ) : topMovers.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: COLORS.textMuted, fontSize: 11 }}>No significant movers today</div>
          ) : (
            topMovers.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderBottom: `1px solid ${COLORS.border}22` }}>
                <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>{s.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 60, height: 6, background: COLORS.bgPanel, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(Math.abs(s.val) * 15, 100)}%`, height: "100%", background: s.val >= 0 ? COLORS.green : COLORS.red, borderRadius: 3, marginLeft: s.val < 0 ? "auto" : 0 }} />
                  </div>
                  <ChgVal val={s.val} />
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* TOP NEWS */}
      <Panel>
        <PanelHeader icon={<Zap size={14} color={COLORS.gold} />} title="TOP NEWS" subtitle="Market-moving headlines" />
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {newsItems.length === 0 ? (
            <LoadingSpinner text="Fetching news..." />
          ) : (
            newsItems.map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}22`, cursor: "pointer" }}
                onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bgPanel)}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <Badge color={COLORS.blue}>{n.publisher?.slice(0, 12) || "News"}</Badge>
                  {n.relatedSymbol && <Badge color={COLORS.green}>{n.relatedSymbol}</Badge>}
                </div>
                <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.3 }}>{n.title}</div>
                {n.publishedAt && (
                  <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>
                    {new Date(n.publishedAt * 1000).toLocaleString()}
                  </div>
                )}
              </a>
            ))
          )}
        </div>
      </Panel>

      {/* MARKET MAP */}
      <Panel>
        <PanelHeader icon={<Layers size={14} color={COLORS.cyan} />} title="MARKET MAP" subtitle="Top stocks by market cap" />
        <div style={{ padding: 8 }}>
          {treemapData.length === 0 ? (
            <LoadingSpinner text="Loading market map..." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 3 }}>
              {treemapData.map((t) => (
                <div key={t.name} style={{ padding: "8px 4px", borderRadius: 3, textAlign: "center", background: t.chg >= 0 ? `rgba(34,197,94,${Math.min(Math.abs(t.chg) * 0.15, 0.5)})` : `rgba(239,68,68,${Math.min(Math.abs(t.chg) * 0.15, 0.5)})`, border: `1px solid ${t.chg >= 0 ? COLORS.green + "33" : COLORS.red + "33"}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: t.chg >= 0 ? COLORS.green : COLORS.red, fontFamily: "'JetBrains Mono',monospace" }}>{fmtPct(t.chg)}</div>
                  <div style={{ fontSize: 8, color: COLORS.textMuted }}>{fmtK(t.size)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* COMMODITIES */}
      <Panel style={{ gridColumn: isMobile ? "1" : "1/-1" }}>
        <PanelHeader icon={<Hash size={14} color={COLORS.gold} />} title="COMMODITIES" subtitle="Real-time commodity prices" />
        <MiniTable
          headers={["Commodity", "Price", "Change", "Unit"]}
          rows={commodities.map((c) => [
            <span style={{ color: COLORS.text }}>{c.name}</span>,
            <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(c.price)}</span>,
            <ChgVal val={c.chg} />,
            <span style={{ color: COLORS.textMuted }}>{c.unit}</span>,
          ])}
        />
      </Panel>

      {/* BONDS */}
      <Panel>
        <PanelHeader icon={<Landmark size={14} color={COLORS.blue} />} title="FIXED INCOME" subtitle="US Treasury yields" />
        <MiniTable
          headers={["Bond", "Yield", "Change"]}
          rows={bonds.map((b) => [
            <span style={{ color: COLORS.text, fontSize: 10 }}>{b.name}</span>,
            <span style={{ color: COLORS.gold, fontWeight: 600 }}>{fmt(b.yield_val)}%</span>,
            <ChgVal val={b.chgBps} suffix="bp" />,
          ])}
        />
      </Panel>
    </div>
  );
}
