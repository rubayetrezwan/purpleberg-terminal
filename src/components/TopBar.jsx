import { Search, Zap, User, Sun, Moon, Menu, X } from "lucide-react";
import { useColors } from "../ThemeContext";
import { Badge } from "../shared";
import Clock from "./Clock";

export default function TopBar({
  isMobile, isTablet, isDark, toggleTheme,
  mobileMenuOpen, setMobileMenuOpen, currentScreen,
  stocksLoading, liveCount, onOpenCommand,
}) {
  const COLORS = useColors();

  return (
    <div
      className="pb-topbar"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 8px" : "0 12px", height: isMobile ? 44 : 38,
        flexShrink: 0, position: "relative", zIndex: 30,
      }}
    >
      {/* Left cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
        {isMobile && (
          <button
            type="button"
            className="pb-reset"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            style={{ padding: 10, margin: -6 }}
          >
            {mobileMenuOpen ? <X size={20} color={COLORS.text} /> : <Menu size={20} color={COLORS.text} />}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="pb-logo-mark" style={{ width: 22, height: 22, borderRadius: 6 }}>
            <Zap size={13} color={COLORS.white} />
          </div>
          <span className="pb-glow-text" style={{ fontSize: isMobile ? "var(--fs-base)" : "var(--fs-lg)", fontWeight: 800, letterSpacing: 1.2, color: "var(--c-purple-light)" }}>
            PURPLEBERG
          </span>
          {!isMobile && <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", fontWeight: 600 }}>TERMINAL</span>}
        </div>
        {!isMobile && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--c-border)" }} />
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-muted)" }}>{currentScreen?.mnemonic}</span>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-dim)" }}>|</span>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--c-text)", fontWeight: 600 }}>{currentScreen?.desc}</span>
          </>
        )}
        {stocksLoading && (
          <span style={{ fontSize: "var(--fs-2xs)", color: "var(--c-orange)", animation: "pulse 1.5s infinite" }}>Loading...</span>
        )}
      </div>

      {/* Right cluster */}
      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="pb-reset" onClick={onOpenCommand} aria-label="Search" style={{ padding: 10, margin: -6 }}>
            <Search size={18} color={COLORS.textMuted} />
          </button>
          <button type="button" className="pb-reset" onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} style={{ padding: 10, margin: -6 }}>
            {isDark ? <Sun size={16} color={COLORS.gold} /> : <Moon size={16} color={COLORS.purpleDark} />}
          </button>
          <Badge color={liveCount > 0 ? COLORS.green : COLORS.orange} dot>{liveCount} LIVE</Badge>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="pb-reset pb-search-pill"
            onClick={onOpenCommand}
            aria-label="Search any stock or function (Ctrl+K)"
            style={{ padding: "5px 14px", minWidth: isTablet ? 200 : 300 }}
          >
            <Search size={13} color={COLORS.textMuted} />
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-muted)" }}>Search any stock, function... (Ctrl+K)</span>
            {!isTablet && (
              <span style={{ fontSize: "var(--fs-2xs)", color: "var(--c-text-muted)", marginLeft: "auto", padding: "1px 6px", background: "color-mix(in srgb, var(--c-border) 44%, transparent)", borderRadius: 2 }}>
                Ctrl+K
              </span>
            )}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="pb-icon-btn" onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
              {isDark ? <Sun size={14} color={COLORS.gold} /> : <Moon size={14} color={COLORS.purpleDark} />}
            </button>
            <Clock color={COLORS.green} />
            <div style={{ width: 1, height: 20, background: "var(--c-border)" }} />
            <Badge color={liveCount > 0 ? COLORS.green : COLORS.orange} dot>{liveCount} LIVE</Badge>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: "color-mix(in srgb, var(--c-purple) 22%, transparent)", border: "1px solid color-mix(in srgb, var(--c-purple) 40%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={12} color={COLORS.purpleLight} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
