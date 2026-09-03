import { useColors } from "../ThemeContext";
import { fmt, fmtK } from "../config";
import { MOBILE_TABS } from "../navConfig";
import { Price } from "../shared";

// Bottom of the shell: scrolling ticker on desktop, quick-tab bar on mobile.
export default function BottomBar({ isMobile, tickerStocks, liveCount, screen, setScreen }) {
  const COLORS = useColors();

  if (isMobile) {
    return (
      <div
        className="pb-bottombar"
        style={{
          height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-around",
          flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)",
          position: "relative", zIndex: 30,
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
      className="pb-bottombar"
      style={{
        height: 26,
        display: "flex", alignItems: "center", overflow: "hidden", flexShrink: 0, position: "relative", zIndex: 30,
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
            <Price value={s.price} format={(v) => fmt(v, s.price > 1000 ? 0 : 2)} style={{ color: "var(--c-text)" }} />

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
          position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 6,
          padding: "0 14px 0 28px", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)",
          background: "linear-gradient(90deg, transparent, var(--c-elevated) 45%)",
        }}
      >
        {liveCount > 0 ? <span className="pb-live-dot" /> : <span style={{ color: "var(--c-red)" }}>●</span>}
        <span className="pb-mono">{liveCount > 0 ? `${liveCount} LIVE` : "..."} | v2.1.0</span>
      </div>
    </div>
  );
}
