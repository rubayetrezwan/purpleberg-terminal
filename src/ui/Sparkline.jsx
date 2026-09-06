import { sparklinePoints } from "./sparklinePath.js";

export function Sparkline({ values, width = 60, height = 14, className = "" }) {
  const points = sparklinePoints(values, width, height, 1);
  if (!points) return <span className={`pb-spark pb-spark--empty${className ? " " + className : ""}`} style={{ width, height }} aria-hidden="true" />;
  const first = values.find((n) => Number.isFinite(n));
  const last = [...values].reverse().find((n) => Number.isFinite(n));
  const tone = last > first ? "pb-up" : last < first ? "pb-down" : "pb-dim";
  return (
    <svg className={`pb-spark ${tone}${className ? " " + className : ""}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
