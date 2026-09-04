// SVG polyline points for a tiny inline chart. Flat series sit on the middle line.
export function sparklinePoints(values, width, height, pad = 1) {
  const v = (Array.isArray(values) ? values : []).filter((n) => typeof n === "number" && Number.isFinite(n));
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min;
  const stepX = (width - pad * 2) / (v.length - 1);
  const yOf = span === 0 ? () => height / 2 : (n) => height - pad - ((n - min) / span) * (height - pad * 2);
  return v.map((n, i) => `${(pad + i * stepX).toFixed(1)},${yOf(n).toFixed(1)}`).join(" ");
}
