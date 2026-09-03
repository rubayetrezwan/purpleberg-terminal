import { useColors } from "./ThemeContext";
import { useState, useEffect, useRef } from "react";

// Primitives shared across every screen. Styling lives in index.css (token
// classes); only genuinely per-instance colours stay inline.

export const Badge = ({ children, color, dot = false }) => {
  const COLORS = useColors();
  const c = color || COLORS.purple;
  return (
    <span className="pb-badge" style={{ background: c + "1f", color: c, borderColor: c + "55" }}>
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: 99, background: c, boxShadow: `0 0 7px ${c}`, flexShrink: 0 }}
        />
      )}
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

// Monospaced value that briefly flashes green/red when it changes — the
// "live tape" feel. Respects prefers-reduced-motion (flash class is a no-op
// under reduced motion via index.css). `format` maps the raw value to display.
export const Price = ({ value, format, className = "", style }) => {
  const prev = useRef(value);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (prev.current != null && value != null && !isNaN(value) && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
    }
    prev.current = value;
  }, [value]);
  return (
    <span
      className={`pb-mono ${flash ? `pb-flash-${flash}` : ""} ${className}`}
      style={style}
      onAnimationEnd={() => setFlash(null)}
    >
      {format ? format(value) : value}
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

export const PanelHeader = ({ title, subtitle, right }) => (
  <div className="pb-panel-header">
    <div>
      <div className="pb-panel-header__title">{title}</div>
      {subtitle && <div className="pb-panel-header__sub">{subtitle}</div>}
    </div>
    {right}
  </div>
);

// `enter` adds the fade-up entrance; pass an index 1-6 to stagger within a grid.
export const Panel = ({ children, style = {}, className = "", enter = true }) => (
  <div className={`pb-panel${enter ? " pb-enter" : ""}${className ? " " + className : ""}`} style={style}>
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
    <table className="pb-table pb-table--hover">
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
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "2px solid color-mix(in srgb, var(--c-purple) 28%, transparent)",
        borderTopColor: "var(--c-purple)",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
        boxShadow: "var(--glow-purple)",
      }}
    />
    {text}
  </div>
);
