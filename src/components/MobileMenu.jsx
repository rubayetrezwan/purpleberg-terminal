import { useColors } from "../ThemeContext";
import { SCREENS } from "../navConfig";

// Mobile slide-out navigation. Overlay closes on tap; items are real buttons.
export default function MobileMenu({ screen, setScreen, onClose }) {
  const COLORS = useColors();
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="pb-reset pb-overlay"
        style={{ position: "absolute", zIndex: 90 }}
      />
      <nav
        aria-label="Main navigation"
        className="pb-sidebar"
        style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: 240,
          zIndex: 100, overflowY: "auto", animation: "slideIn 0.2s ease-out",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border)" }}>
          <div style={{ fontSize: "var(--fs-base)", color: "var(--c-text-muted)", fontWeight: 600, letterSpacing: 1 }}>NAVIGATION</div>
        </div>
        {SCREENS.map((s) => {
          const Icon = s.icon;
          const active = screen === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setScreen(s.id); onClose(); }}
              aria-current={active ? "page" : undefined}
              className={`pb-reset pb-nav-item${active ? " pb-nav-item--active" : ""}`}
              style={{ gap: 12, padding: "12px 16px" }}
            >
              <Icon size={16} color={active ? COLORS.purpleLight : COLORS.textMuted} />
              <span>
                <span style={{ display: "block", fontSize: "var(--fs-md)", fontWeight: active ? 700 : 500, color: active ? "var(--c-purple-light)" : "var(--c-text)" }}>
                  {s.label}
                </span>
                <span style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>{s.desc}</span>
              </span>
            </button>
          );
        })}
        <div style={{ padding: 16, borderTop: "1px solid var(--c-border)" }}>
          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--c-text-muted)", letterSpacing: 1, textAlign: "center" }}>
            PURPLEBERG v2.1.0
            <div style={{ fontSize: "var(--fs-2xs)", color: "var(--c-purple)", marginTop: 2, fontWeight: 600 }}>by Rubayet Rezwan</div>
          </div>
        </div>
      </nav>
    </>
  );
}
