// Signed, coloured change. Replaces the old ChgVal.
export function Change({ value, suffix = "%", decimals = 2, arrow = false, className = "" }) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return <span className={`pb-muted${className ? " " + className : ""}`}>—</span>;
  }
  const v = Object.is(Number(value), -0) ? 0 : Number(value);
  const tone = v > 0 ? "pb-up" : v < 0 ? "pb-down" : "pb-dim";
  const glyph = arrow ? (v > 0 ? "▲ " : v < 0 ? "▼ " : "") : "";
  return (
    <span className={`pb-change ${tone}${className ? " " + className : ""}`}>
      {glyph}{v > 0 ? "+" : ""}{v.toFixed(decimals)}{suffix}
    </span>
  );
}
