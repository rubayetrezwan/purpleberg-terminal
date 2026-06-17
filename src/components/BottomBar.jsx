import { useColors } from "../ThemeContext";
import { fmt, fmtK } from "../config";
import { MOBILE_TABS } from "../navConfig";

// Bottom of the shell: scrolling ticker on desktop, quick-tab bar on mobile.
export default function BottomBar({ isMobile, tickerStocks, liveCount, screen, setScreen }) {
  const COLORS = useColors();

  if (isMobile) {
    return (
      <div
        style={{
          height: 56, background: "var(--c-panel)", borderTop: "1px solid var(--c-border)",
          display: "flex", alignItems: "center", justifyContent: "space-around",
          flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="pb-reset"
              onClick={() => setScreen(tab.id)}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "6px 12px", minHeight: 44, justifyContent: "center", opacity: active ? 1 : 0.6,
              }}
            >
              <Icon size={18} color={active ? COLORS.purple : COLORS.textMuted} />
              <span style={{ fontSize: "var(--fs-2xs)", fontWeight: active ? 700 : 500, color: active ? "var(--c-purple-light)" : "var(--c-text-muted)" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        height: 24, background: "var(--c-panel)", borderTop: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", overflow: "hidden", flexShrink: 0, position: "relative",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 24, whiteSpace: "nowrap",
          animation: tickerStocks.length > 0 ? "tickerScroll 60s linear infinite" : "none",
        }}
      >
        {[...tickerStocks, ...tickerStocks].map((s, i) => (
          <span key={`${s.symbol}-${i}`} style={{ fontSize: "var(--fs-xs)", whiteSpace: "nowrap", display: "inline-flex", gap: 4, alignItems: "center" }}>
            <span style={{ color: "var(--c-text-muted)", fontWeight: 600 }}>{s.symbol}</span>
            <span className="pb-mono" style={{ color: "var(--c-text)" }}>{fmt(s.price, s.price > 1000 ? 0 : 2)}</span>
            <span className={`pb-mono ${(s.changePercent ?? 0) >= 0 ? "pb-pos" : "pb-neg"}`}>
              {(s.changePercent ?? 0) >= 0 ? "+" : ""}{fmt(s.changePercent)}%
            </span>
            <span className="pb-mono" style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-2xs)" }}>{fmtK(s.marketCap)}</span>
            <span style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-2xs)" }}>{s.pe > 0 ? `${fmt(s.pe, 1)}x` : ""}</span>
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center",
          padding: "0 12px", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)",
          background: "linear-gradient(90deg, transparent, var(--c-panel) 30%)",
        }}
      >
        <span style={{ color: liveCount > 0 ? "var(--c-green)" : "var(--c-red)" }}>●</span>
        {" "}
        {liveCount > 0 ? `${liveCount} LIVE` : "..."} | v2.1.0
      </div>
    </div>
  );
}
