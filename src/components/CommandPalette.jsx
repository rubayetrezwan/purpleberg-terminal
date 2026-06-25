import { useRef, useEffect, useMemo } from "react";
import { Command, Search, TrendingUp, ChevronRight } from "lucide-react";
import { useColors } from "../ThemeContext";
import { useSearch } from "../hooks";
import { fmt, fmtK } from "../config";
import { SCREENS } from "../navConfig";
import { Badge, ChgVal } from "../shared";

// Self-contained command palette: owns its search/filter derivation; App owns
// only open/query state and the select handlers (which change screen/symbol).
export default function CommandPalette({ open, query, setQuery, allStockQuotes, isMobile, onSelectScreen, onSelectStock, onClose }) {
  const COLORS = useColors();
  const inputRef = useRef(null);
  const { results: searchResults, loading: searchLoading } = useSearch(query, 400);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filteredScreens = useMemo(
    () =>
      query
        ? SCREENS.filter(
            (s) =>
              s.label.toLowerCase().includes(query.toLowerCase()) ||
              s.mnemonic.toLowerCase().includes(query.toLowerCase()) ||
              s.desc.toLowerCase().includes(query.toLowerCase())
          )
        : SCREENS,
    [query]
  );

  const filteredStocks = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return allStockQuotes
      .filter((s) => s.symbol.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, allStockQuotes]);

  const yahooResults = useMemo(() => {
    if (!searchResults.length) return [];
    const loaded = new Set(filteredStocks.map((s) => s.symbol));
    return searchResults.filter((r) => !loaded.has(r.symbol)).slice(0, 6);
  }, [searchResults, filteredStocks]);

  if (!open) return null;

  const rowStyle = { gap: 12, padding: isMobile ? "12px 16px" : "8px 16px", borderBottom: "1px solid color-mix(in srgb, var(--c-border) 22%, transparent)" };
  const sectionLabel = { padding: "6px 16px", fontSize: "var(--fs-2xs)", fontWeight: 600, color: "var(--c-text-muted)", letterSpacing: 1, borderBottom: "1px solid color-mix(in srgb, var(--c-border) 22%, transparent)" };

  return (
    <div
      onClick={onClose}
      className="pb-overlay"
      style={{
        display: "flex", alignItems: isMobile ? "flex-end" : "flex-start", justifyContent: "center",
        paddingTop: isMobile ? 0 : 100, zIndex: 999,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="pb-dialog pb-enter"
        style={{
          width: isMobile ? "100%" : 540, maxHeight: isMobile ? "70vh" : "auto",
          border: isMobile ? "none" : "1px solid color-mix(in srgb, var(--c-purple) 30%, var(--c-border))",
          borderRadius: isMobile ? "16px 16px 0 0" : 12,
          display: "flex", flexDirection: "column",
        }}
      >
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--c-border)" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "8px 16px" : "12px 16px", borderBottom: "1px solid var(--c-border)" }}>
          <Command size={16} color={COLORS.purple} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (filteredStocks.length > 0) onSelectStock(filteredStocks[0].symbol);
                else if (filteredScreens.length > 0) onSelectScreen(filteredScreens[0].id);
              }
            }}
            placeholder="Search any stock, ETF, or function..."
            aria-label="Search any stock, ETF, or function"
            style={{ flex: 1, background: "transparent", border: "none", color: "var(--c-text)", fontSize: isMobile ? 16 : 14, outline: "none" }}
          />
          <button type="button" className="pb-reset" onClick={onClose} style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", padding: "2px 6px", background: "color-mix(in srgb, var(--c-border) 44%, transparent)", borderRadius: 2 }}>
            {isMobile ? "CLOSE" : "ESC"}
          </button>
        </div>

        <div style={{ maxHeight: isMobile ? "55vh" : 360, overflowY: "auto" }}>
          {filteredStocks.length > 0 && (
            <>
              <div style={sectionLabel}>TRACKED EQUITIES</div>
              {filteredStocks.map((s) => (
                <button key={s.symbol} type="button" className="pb-reset pb-row" onClick={() => onSelectStock(s.symbol)} style={rowStyle}>
                  <TrendingUp size={14} color={COLORS.green} />
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--c-purple-light)" }}>{s.symbol}</span>
                    <span style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>{(s.name || "").slice(0, 30)}</span>
                  </span>
                  <span className="pb-mono" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "var(--fs-base)", fontWeight: 600, color: "var(--c-text)" }}>{fmt(s.price)}</span>
                    <ChgVal val={s.changePercent} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-dim)" }}>{fmtK(s.marketCap)}</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>{s.pe > 0 ? fmt(s.pe, 1) + "x" : "N/A"}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {(yahooResults.length > 0 || searchLoading) && query.length >= 2 && (
            <>
              <div style={sectionLabel}>{searchLoading ? "SEARCHING YAHOO FINANCE..." : "YAHOO FINANCE SEARCH"}</div>
              {yahooResults.map((r) => (
                <button key={r.symbol} type="button" className="pb-reset pb-row" onClick={() => onSelectStock(r.symbol)} style={rowStyle}>
                  <Search size={14} color={COLORS.cyan} />
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--c-cyan)" }}>{r.symbol}</span>
                    <span style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>{(r.name || "").slice(0, 40)}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge color={COLORS.blue}>{r.type || "EQUITY"}</Badge>
                    <Badge>{r.exchange || "—"}</Badge>
                    <ChevronRight size={12} color={COLORS.textMuted} />
                  </span>
                </button>
              ))}
            </>
          )}

          {filteredScreens.length > 0 && (
            <>
              {filteredStocks.length > 0 && <div style={sectionLabel}>FUNCTIONS</div>}
              {filteredScreens.map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.id} type="button" className="pb-reset pb-row" onClick={() => onSelectScreen(s.id)} style={rowStyle}>
                    <Icon size={16} color={COLORS.purple} />
                    <span style={{ flex: 1, textAlign: "left" }}>
                      <span style={{ display: "block", fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--c-text)" }}>{s.label}</span>
                      <span style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>{s.desc}</span>
                    </span>
                    <span className="pb-mono" style={{ fontSize: "var(--fs-sm)", color: "var(--c-purple-light)", padding: "2px 8px", background: "color-mix(in srgb, var(--c-purple-dim) 44%, transparent)", borderRadius: 3 }}>
                      {s.mnemonic}
                    </span>
                    <ChevronRight size={14} color={COLORS.textMuted} />
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
