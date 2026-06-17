import { useColors } from "./ThemeContext";

// Primitives shared across every screen. Styling lives in index.css (token
// classes); only genuinely per-instance colours stay inline.

export const Badge = ({ children, color }) => {
  const COLORS = useColors();
  const c = color || COLORS.purple;
  return (
    <span className="pb-badge" style={{ background: c + "22", color: c }}>
      {children}
    </span>
  );
};

export const ChgVal = ({ val, suffix = "%" }) => {
  if (val == null || isNaN(val)) return <span className="pb-muted">--</span>;
  const v = Object.is(val, -0) ? 0 : val;
  return (
    <span
      className={`pb-mono ${v >= 0 ? "pb-pos" : "pb-neg"}`}
      style={{ fontWeight: 600, fontSize: "var(--fs-base)" }}
    >
      {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(2)}
      {suffix}
    </span>
  );
};

export const DataCell = ({ label, value, sub, color }) => (
  <div style={{ padding: "6px 0" }}>
    <div className="pb-datacell__label">{label}</div>
    <div className="pb-datacell__value" style={{ color: color || "var(--c-text)" }}>
      {value}
    </div>
    {sub && <div className="pb-datacell__sub">{sub}</div>}
  </div>
);

export const PanelHeader = ({ icon, title, subtitle, right }) => (
  <div className="pb-panel-header">
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
      {icon}
      <div>
        <div className="pb-panel-header__title">{title}</div>
        {subtitle && <div className="pb-panel-header__sub">{subtitle}</div>}
      </div>
    </div>
    {right}
  </div>
);

export const Panel = ({ children, style = {} }) => (
  <div className="pb-panel" style={style}>
    {children}
  </div>
);

export const TabBar = ({ tabs, active, onChange }) => (
  <div className="pb-tabbar" role="tablist">
    {tabs.map((t) => (
      <button
        key={t}
        type="button"
        role="tab"
        aria-selected={active === t}
        className={`pb-tab${active === t ? " pb-tab--active" : ""}`}
        onClick={() => onChange(t)}
      >
        {t}
      </button>
    ))}
  </div>
);

export const MiniTable = ({ headers, rows }) => (
  <div style={{ overflowX: "auto" }}>
    <table className="pb-table">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const LoadingSpinner = ({ text = "Loading..." }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      color: "var(--c-text-muted)",
      fontSize: "var(--fs-base)",
      gap: "var(--sp-2)",
    }}
  >
    <span style={{ animation: "pulse 1.5s infinite" }}>{"◎"}</span> {text}
  </div>
);
