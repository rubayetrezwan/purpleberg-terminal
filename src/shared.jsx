import { useColors } from "./ThemeContext";

export const Badge = ({ children, color }) => {
  const COLORS = useColors();
  const c = color || COLORS.purple;
  return (
    <span
      style={{
        background: c + "22",
        color: c,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </span>
  );
};

export const ChgVal = ({ val, suffix = "%" }) => {
  const COLORS = useColors();
  if (val == null || isNaN(val)) return <span style={{ color: COLORS.textMuted }}>--</span>;
  const v = Object.is(val, -0) ? 0 : val;
  return (
    <span
      style={{
        color: v >= 0 ? COLORS.green : COLORS.red,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 12,
      }}
    >
      {v >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(v).toFixed(2)}
      {suffix}
    </span>
  );
};

export const DataCell = ({ label, value, sub, color }) => {
  const COLORS = useColors();
  return (
    <div style={{ padding: "6px 0" }}>
      <div
        style={{
          fontSize: 10,
          color: COLORS.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: color || COLORS.text,
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: COLORS.textDim }}>{sub}</div>
      )}
    </div>
  );
};

export const PanelHeader = ({ icon, title, subtitle, right }) => {
  const COLORS = useColors();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgPanel,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: 0.5,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
};

export const Panel = ({ children, style = {} }) => {
  const COLORS = useColors();
  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const TabBar = ({ tabs, active, onChange }) => {
  const COLORS = useColors();
  return (
    <div
      style={{
        display: "flex",
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgPanel,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "8px 16px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            cursor: "pointer",
            border: "none",
            background:
              active === t ? COLORS.purpleDim + "66" : "transparent",
            color: active === t ? COLORS.purpleLight : COLORS.textMuted,
            borderBottom:
              active === t
                ? `2px solid ${COLORS.purple}`
                : "2px solid transparent",
            textTransform: "uppercase",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
};

export const MiniTable = ({ headers, rows }) => {
  const COLORS = useColors();
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "6px 8px",
                  textAlign: i === 0 ? "left" : "right",
                  color: COLORS.textMuted,
                  borderBottom: `1px solid ${COLORS.border}`,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "5px 8px",
                    textAlign: ci === 0 ? "left" : "right",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const LoadingSpinner = ({ text = "Loading..." }) => {
  const COLORS = useColors();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        color: COLORS.textMuted,
        fontSize: 12,
        gap: 8,
      }}
    >
      <span style={{ animation: "pulse 1.5s infinite" }}>{"\u25CE"}</span> {text}
    </div>
  );
};
