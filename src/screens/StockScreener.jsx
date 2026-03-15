import { useState, useMemo } from "react";
import { Filter } from "lucide-react";
import { fmt, fmtK, fmtPct } from "../config";
import { useColors } from "../ThemeContext";
import { Panel, PanelHeader, Badge, ChgVal, LoadingSpinner } from "../shared";

export default function StockScreener({ allStockQuotes }) {
  const COLORS = useColors();
  const stocks = allStockQuotes || [];
  const [sortCol, setSortCol] = useState("marketCap");
  const [sortDir, setSortDir] = useState(-1);
  const [filterExchange, setFilterExchange] = useState("All");
  const [filterMinPE, setFilterMinPE] = useState("");
  const [filterMaxPE, setFilterMaxPE] = useState("");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const exchanges = useMemo(() => {
    const set = new Set(stocks.map((s) => s.exchange).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [stocks]);

  const filtered = useMemo(() => {
    let arr = [...stocks];
    if (filterExchange !== "All") arr = arr.filter((s) => s.exchange === filterExchange);
    if (filterMinPE) arr = arr.filter((s) => s.pe >= parseFloat(filterMinPE));
    if (filterMaxPE) arr = arr.filter((s) => s.pe <= parseFloat(filterMaxPE) && s.pe > 0);
    if (filterMinPrice) arr = arr.filter((s) => s.price >= parseFloat(filterMinPrice));
    if (filterMaxPrice) arr = arr.filter((s) => s.price <= parseFloat(filterMaxPrice));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((s) => s.symbol.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const aVal = a[sortCol] ?? 0;
      const bVal = b[sortCol] ?? 0;
      return (aVal > bVal ? 1 : -1) * sortDir;
    });
    return arr;
  }, [stocks, filterExchange, filterMinPE, filterMaxPE, filterMinPrice, filterMaxPrice, searchQuery, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d * -1);
    else { setSortCol(col); setSortDir(-1); }
  };

  const columns = [
    { k: "symbol", l: "TICKER", align: "left" },
    { k: "name", l: "NAME", align: "left" },
    { k: "price", l: "PRICE", align: "right" },
    { k: "changePercent", l: "CHG %", align: "right" },
    { k: "marketCap", l: "MKT CAP", align: "right" },
    { k: "pe", l: "P/E", align: "right" },
    { k: "volume", l: "VOLUME", align: "right" },
    { k: "beta", l: "BETA", align: "right" },
    { k: "dividendYield", l: "DIV %", align: "right" },
    { k: "exchange", l: "EXCH", align: "right" },
  ];

  return (
    <div style={{ padding: 12 }}>
      <Panel>
        <PanelHeader
          icon={<Filter size={14} color={COLORS.purple} />}
          title="EQUITY SCREENER"
          subtitle="Real-time multi-criteria stock screening"
          right={<Badge>{filtered.length} results</Badge>}
        />

        {/* FILTERS */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 12, alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: 10, color: COLORS.textMuted, marginRight: 6 }}>SEARCH:</span>
            <input
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Symbol or name..."
              style={{ width: 120, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11, outline: "none" }}
            />
          </div>
          <div>
            <span style={{ fontSize: 10, color: COLORS.textMuted, marginRight: 6 }}>EXCHANGE:</span>
            <select
              value={filterExchange} onChange={(e) => setFilterExchange(e.target.value)}
              style={{ background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11 }}
            >
              {exchanges.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <span style={{ fontSize: 10, color: COLORS.textMuted, marginRight: 6 }}>P/E:</span>
            <input value={filterMinPE} onChange={(e) => setFilterMinPE(e.target.value)} placeholder="Min" style={{ width: 45, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11, outline: "none" }} />
            <span style={{ color: COLORS.textMuted, margin: "0 4px" }}>-</span>
            <input value={filterMaxPE} onChange={(e) => setFilterMaxPE(e.target.value)} placeholder="Max" style={{ width: 45, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11, outline: "none" }} />
          </div>
          <div>
            <span style={{ fontSize: 10, color: COLORS.textMuted, marginRight: 6 }}>PRICE:</span>
            <input value={filterMinPrice} onChange={(e) => setFilterMinPrice(e.target.value)} placeholder="Min" style={{ width: 50, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11, outline: "none" }} />
            <span style={{ color: COLORS.textMuted, margin: "0 4px" }}>-</span>
            <input value={filterMaxPrice} onChange={(e) => setFilterMaxPrice(e.target.value)} placeholder="Max" style={{ width: 50, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 3, padding: "4px 6px", fontSize: 11, outline: "none" }} />
          </div>
        </div>

        {/* TABLE */}
        {stocks.length === 0 ? (
          <LoadingSpinner text="Loading stock data..." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {columns.map((h) => (
                    <th
                      key={h.k}
                      onClick={() => toggleSort(h.k)}
                      style={{
                        padding: 8, textAlign: h.align,
                        color: sortCol === h.k ? COLORS.purpleLight : COLORS.textMuted,
                        cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`,
                        fontSize: 10, fontWeight: 600, letterSpacing: 0.5, userSelect: "none",
                      }}
                    >
                      {h.l} {sortCol === h.k ? (sortDir > 0 ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.symbol} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: COLORS.purpleLight }}>{s.symbol.replace(".DS", "")}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.textDim, fontSize: 10 }}>{(s.name || "").slice(0, 22)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(s.price)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}><ChgVal val={s.changePercent} /></td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{fmtK(s.marketCap)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: COLORS.text }}>{s.pe > 0 ? fmt(s.pe, 1) : "N/A"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim }}>{fmtK(s.volume)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: s.beta > 1.5 ? COLORS.red : s.beta < 0.8 ? COLORS.green : COLORS.text }}>{s.beta ? fmt(s.beta) : "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: s.dividendYield > 0 ? COLORS.green : COLORS.textMuted }}>{s.dividendYield > 0 ? fmt(s.dividendYield) + "%" : "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}><Badge color={COLORS.blue}>{s.exchange || "—"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
