import { Maximize2, Minimize2 } from "lucide-react";
import { useColors } from "../ThemeContext";
import { SCREENS } from "../navConfig";

// Desktop sidebar nav. Each item is a real <button> (was a div onClick) with
// aria-current marking the active screen.
export default function Sidebar({ screen, setScreen, collapsed, setCollapsed, isTablet }) {
  const COLORS = useColors();
  return (
    <div
      className="pb-sidebar"
      style={{
        width: collapsed ? 48 : isTablet ? 130 : 160,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s",
        position: "relative",
        zIndex: 20,
      }}
    >
      <button
        type="button"
        className="pb-reset"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        style={{ padding: 8, borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "center" }}
      >
        {collapsed ? <Maximize2 size={14} color={COLORS.textMuted} /> : <Minimize2 size={14} color={COLORS.textMuted} />}
      </button>

      {SCREENS.map((s) => {
        const Icon = s.icon;
        const active = screen === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setScreen(s.id)}
            title={s.desc}
            aria-current={active ? "page" : undefined}
            className={`pb-reset pb-nav-item${active ? " pb-nav-item--active" : ""}`}
            style={{ padding: collapsed ? "10px 0" : "8px 12px", justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <Icon size={14} color={active ? COLORS.purpleLight : COLORS.textMuted} />
            {!collapsed && (
              <span>
                <span style={{ display: "block", fontSize: "var(--fs-sm)", fontWeight: active ? 700 : 500, color: active ? "var(--c-purple-light)" : "var(--c-text-dim)" }}>
                  {s.label}
                </span>
                <span style={{ display: "block", fontSize: "var(--fs-2xs)", color: "var(--c-text-muted)" }}>{s.mnemonic}</span>
              </span>
            )}
          </button>
        );
      })}

      <div style={{ marginTop: "auto", padding: 8, borderTop: "1px solid var(--c-border)", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "var(--c-text-muted)", letterSpacing: 1 }}>PURPLEBERG</div>
        <div style={{ fontSize: 7, color: "var(--c-text-muted)" }}>v2.1.0 | Live Data</div>
        <div style={{ fontSize: 8, color: "var(--c-purple)", marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>by Rubayet Rezwan</div>
      </div>
    </div>
  );
}
