import { useColors } from "./ThemeContext";

// Shared recharts styling so every chart across the terminal gets the same
// glass tooltip, hairline grid, and muted axes. Screens spread these onto their
// <CartesianGrid>, <XAxis>/<YAxis>, and <Tooltip> instead of inlining styles.
//
// Usage:
//   const { gridProps, axisProps, tooltipProps, COLORS } = useChartTheme();
//   <CartesianGrid {...gridProps} />
//   <XAxis dataKey="t" {...axisProps} />
//   <Tooltip {...tooltipProps} />
//   <defs><ChartGradient id="gp" color={COLORS.purple} /></defs>
//   <Area ... fill="url(#gp)" />
export function useChartTheme() {
  const COLORS = useColors();

  const tooltipProps = {
    contentStyle: {
      background: "var(--c-glass-strong)",
      backdropFilter: "blur(12px) saturate(135%)",
      WebkitBackdropFilter: "blur(12px) saturate(135%)",
      border: "1px solid color-mix(in srgb, var(--c-purple) 28%, var(--c-border))",
      borderRadius: 8,
      boxShadow: "var(--shadow-panel)",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      padding: "8px 10px",
    },
    labelStyle: { color: "var(--c-text-muted)", fontSize: 10, marginBottom: 4, letterSpacing: 0.4 },
    itemStyle: { color: "var(--c-text)", fontSize: 11, padding: 0 },
    cursor: { stroke: COLORS.purple, strokeWidth: 1, strokeOpacity: 0.45 },
  };

  // Horizontal-only hairline grid keeps charts legible without visual noise.
  const gridProps = {
    strokeDasharray: "2 4",
    stroke: COLORS.border + "66",
    vertical: false,
  };

  const axisProps = {
    tick: { fill: COLORS.textMuted, fontSize: 10 },
    tickLine: false,
    axisLine: { stroke: COLORS.border + "88" },
    stroke: COLORS.textMuted,
  };

  return { COLORS, tooltipProps, gridProps, axisProps };
}

// Vertical fade gradient for area-chart fills.
export const ChartGradient = ({ id, color, from = 0.34, to = 0 }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={color} stopOpacity={from} />
    <stop offset="95%" stopColor={color} stopOpacity={to} />
  </linearGradient>
);
