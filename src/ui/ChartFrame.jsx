import { useMemo } from "react";
import { ResponsiveContainer } from "recharts";
import { useResolvedTheme } from "../theme/useResolvedTheme.js";
import { Loading } from "./Loading.jsx";
import { EmptyState } from "./EmptyState.jsx";

// Recharts needs concrete colours for SVG attributes, so read the tokens once
// per theme change instead of hardcoding a palette in JS. Series 1 is the
// accent shade that reads as a line on the canvas; the rest of the ramp keeps
// at least 3:1 against the raised surface in its theme.
function readColors(theme) {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  const accentText = g("--c-accent-text");
  const muted = g("--c-text-muted");
  const series = theme === "light"
    ? [accentText, "#8b5cf6", muted, "#9d4edd", "#3f3f46", "#a855f7"]
    : [accentText, "#8b5cf6", muted, "#c4b5fd", "#6b6b78", "#ddd6fe"];
  return {
    accent: g("--c-accent"), accentText, text: g("--c-text"), dim: g("--c-text-dim"),
    muted, line: g("--c-line"), lineStrong: g("--c-line-strong"), up: g("--c-up"),
    down: g("--c-down"), warn: g("--c-warn"), raised: g("--c-raised"), bg: g("--c-bg"), series,
  };
}

export function useChartColors() {
  const theme = useResolvedTheme();
  return useMemo(() => readColors(theme), [theme]);
}

// Spread these onto <CartesianGrid>, <XAxis>/<YAxis>, <Tooltip>, <Line>, <Area>.
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
    lineProps: { strokeWidth: 1.5, dot: false, activeDot: { r: 3, strokeWidth: 0 }, isAnimationActive: false },
    // Flat 8% fill, no gradient (spec 3.3 and rule 3).
    areaProps: { strokeWidth: 1.5, dot: false, fillOpacity: 0.08, activeDot: { r: 3, strokeWidth: 0 }, isAnimationActive: false },
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
