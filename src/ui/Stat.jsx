// Label over a value. `tone` is "up" | "down" | "warn" | "accent".
export function Stat({ label, value, sub, tone, align = "left", size = "md", className = "" }) {
  return (
    <div className={`pb-stat pb-stat--${align} pb-stat--${size}${className ? " " + className : ""}`}>
      <div className="pb-stat__label">{label}</div>
      <div className={`pb-stat__value${tone ? ` pb-${tone}` : ""}`}>{value}</div>
      {sub != null && sub !== "" && <div className="pb-stat__sub">{sub}</div>}
    </div>
  );
}

export function StatRow({ cols, className = "", children }) {
  return (
    <div className={`pb-statrow${className ? " " + className : ""}`} style={cols ? { gridTemplateColumns: cols } : undefined}>
      {children}
    </div>
  );
}
