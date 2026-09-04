import { useMemo } from "react";
import { ResponsiveContainer } from "recharts";
import { useResolvedTheme } from "../theme/useResolvedTheme.js";
import { Loading } from "./Loading.jsx";
import { EmptyState } from "./EmptyState.jsx";

// Recharts needs concrete colours for SVG attributes, so read the tokens once
// per theme change instead of hardcoding a palette in JS.
function readColors(theme) {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  const series = theme === "light"
    ? ["#6d28d9", "#8b5cf6", "#6e6e6e", "#a78bfa", "#3f3f46", "#c4b5fd"]
    : ["#8b5cf6", "#a78bfa", "#787878", "#c4b5fd", "#5b5b66", "#ddd6fe"];
  return {
    accent: g("--c-accent"), accentText: g("--c-accent-text"), text: g("--c-text"), dim: g("--c-text-dim"),
    muted: g("--c-text-muted"), line: g("--c-line"), lineStrong: g("--c-line-strong"), up: g("--c-up"),
    down: g("--c-down"), warn: g("--c-warn"), raised: g("--c-raised"), bg: g("--c-bg"), series,
  };
}

export function useChartColors() {
  const theme = useResolvedTheme();
  return useMemo(() => readColors(theme), [theme]);
}

// Spread these onto <CartesianGrid>, <XAxis>/<YAxis>, and <Tooltip>.
export function useChartTheme() {
  const colors = useChartColors();
  return useMemo(() => ({
    colors,
    gridProps: { stroke: colors.line, vertical: false },
    axisProps: { tick: { fill: colors.muted, fontSize: 10, fontFamily: "inherit" }, tickLine: false, axisLine: false, stroke: colors.muted },
    tooltipProps: {
      contentStyle: { background: colors.raised, border: `1px solid ${colors.lineStrong}`, borderRadius: 0, fontSize: 11, fontFamily: "inherit", padding: "6px 8px" },
      labelStyle: { color: colors.muted, fontSize: 10, marginBottom: 2 },
      itemStyle: { color: colors.text, fontSize: 11, padding: 0 },
      cursor: { stroke: colors.muted, strokeWidth: 1 },
    },
  }), [colors]);
}

export function ChartFrame({ height = 280, loading = false, empty = null, className = "", children }) {
  return (
    <div className={`pb-chart${className ? " " + className : ""}`} style={{ height }}>
      {loading ? <Loading /> : empty ? <EmptyState>{empty}</EmptyState> : (
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      )}
    </div>
  );
}

// Faint vertical fade for area fills (8% at the top, 0 at the bottom).
export function ChartGradient({ id, color, from = 0.08, to = 0 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={from} />
      <stop offset="95%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}
