// Signed, coloured change. Replaces the old ChgVal.
export function Change({ value, suffix = "%", decimals = 2, arrow = false, className = "" }) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return <span className={`pb-muted${className ? " " + className : ""}`}>—</span>;
  }
  // Tone and sign follow the value as printed: -0.001% shows as a flat
  // 0.00%, not a red "-0.00%".
  const r = Number(Number(value).toFixed(decimals));
  const v = Object.is(r, -0) ? 0 : r;
  const tone = v > 0 ? "pb-up" : v < 0 ? "pb-down" : "pb-dim";
  const glyph = arrow ? (v > 0 ? "▲ " : v < 0 ? "▼ " : "") : "";
  return (
    <span className={`pb-change ${tone}${className ? " " + className : ""}`}>
      {glyph}{v > 0 ? "+" : ""}{v.toFixed(decimals)}{suffix}
    </span>
  );
}
