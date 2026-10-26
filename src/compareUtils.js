// Pure helpers for the Compare screen, and the fundamentals and chart-axis
// helpers Equities shares with it. No React, no DOM — just data. Kept out of
// the components so node:test can exercise them without a UI harness.
import { fmtNum } from "./lib/format.js";
import { niceTicks } from "./lib/axis.js";

/**
 * Convert a historical price series into a "% from start" series.
 * Input:  [{date, close, ...}]
 * Output: [{date, pct}]  where pct = 0 at index 0 and (close - first) / first * 100 after.
 * Empty / nullish input returns []. A zero first-close yields all zeros (no divide-by-zero).
 */
export function normalizeToPct(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const firstClose = series[0].close;
  if (!firstClose) {
    // Can't normalize around zero; return zeros so the chart still draws a flat line.
    return series.map((d) => ({ date: d.date, pct: 0 }));
  }
  return series.map((d) => ({
    date: d.date,
    pct: ((d.close - firstClose) / firstClose) * 100,
  }));
}

/**
 * Outer-join two normalized series on date. Missing values become null so Recharts
 * can draw gaps cleanly with `connectNulls={false}`.
 * Input:  [{date, pct}], [{date, pct}]
 * Output: [{date, a, b}]  sorted ascending by date.
 */
export function alignTimelines(a, b) {
  const safeA = Array.isArray(a) ? a : [];
  const safeB = Array.isArray(b) ? b : [];
  const map = new Map();
  for (const row of safeA) map.set(row.date, { date: row.date, a: row.pct, b: null });
  for (const row of safeB) {
    const existing = map.get(row.date);
    if (existing) existing.b = row.pct;
    else map.set(row.date, { date: row.date, a: null, b: row.pct });
  }
  return Array.from(map.values()).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/**
 * A metric from a quote or financials payload as a finite number, or null.
 * Accepts numbers, numeric strings ("12.3") and Yahoo's {raw} objects. The proxy
 * sends 0 (or "0") for any ratio or margin it could not source, so a zero reads
 * as missing here rather than as a real 0.0% margin or 0.00x multiple.
 */
export function metricValue(v) {
  if (v == null || v === "") return null;
  let n;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") n = parseFloat(v);
  else if (typeof v === "object" && "raw" in v) n = Number(v.raw);
  else n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/**
 * Pick the "winner" between two numeric values. Returns 'a', 'b', or null (tie / missing).
 * `higherIsBetter` flips the comparison for metrics like P/E where lower is better.
 * Both sides must be real numbers: lighting the value next to a "—" would crown a
 * number nobody can compare. Zero is treated as missing data (common in our quote
 * payloads). When lower is better, a value at or below zero is not cheap but
 * meaningless (a loss-maker's P/E, negative book value), so nobody wins.
 */
export function winnerOf(aVal, bVal, higherIsBetter) {
  if (!Number.isFinite(aVal) || !Number.isFinite(bVal) || aVal === 0 || bVal === 0) return null;
  if (!higherIsBetter && (aVal < 0 || bVal < 0)) return null;
  if (aVal === bVal) return null;
  const aBetter = higherIsBetter ? aVal > bVal : aVal < bVal;
  return aBetter ? "a" : "b";
}

/**
 * The currency a company's statements are in, when it is not the currency its
 * shares are quoted in; null when they match or either is unknown. An ADR such
 * as TSM reports in Taiwan dollars but trades in US dollars, so its revenue
 * must carry "TWD", and any ratio that divides a dollar price by a Taiwan
 * dollar figure is meaningless.
 */
export function statementCurrency(fin, quote) {
  const fc = fin && fin.financialCurrency;
  const qc = quote && quote.currency;
  return fc && qc && fc !== qc ? fc : null;
}

// Yahoo's P/S, P/B and EV/EBITDA put the quoted price or market cap over a
// statement figure, so they are wrong whenever statementCurrency() is set.
// P/E and forward P/E use per-share earnings Yahoo already quotes in the
// trading currency; ROE, ROA, debt to equity and the current ratio divide one
// statement figure by another, so the currencies cancel.
export const CROSS_CURRENCY_RATIOS = ["ps", "pb", "evEbitda"];

/**
 * Everything a Recharts value axis needs, from the values on screen:
 * { ticks, domain, format, width }. A $12 stock needs decimals on its ticks or
 * neighbouring labels repeat; a $500 one does not. `width` fits the longest
 * label at the charts' 10px monospace. With no finite values the axis falls
 * back to Recharts' own "auto" range.
 */
export function valueAxis(values, suffix = "") {
  const finite = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  const scale = niceTicks(finite);
  const ticks = scale ? scale.ticks : [];
  const decimals = scale ? scale.decimals : 2;
  const format = (v) => fmtNum(v, decimals) + suffix;
  const longest = Math.max(4, ...ticks.map((t) => format(t).length));
  return {
    ticks: ticks.length ? ticks : undefined,
    domain: ticks.length ? [ticks[0], ticks[ticks.length - 1]] : ["auto", "auto"],
    format,
    width: Math.max(40, (longest + 1) * 6 + 8),
  };
}

/**
 * Whole-number shares of `total` that add up to exactly `total`, by largest
 * remainder: floor every share, then give the units left over to the largest
 * fractional parts. Rounding each share on its own can print 57/35/9 = 101%.
 * Non-finite or negative inputs count as 0; an all-zero input stays all zero.
 */
export function largestRemainder(values, total = 100) {
  const v = (Array.isArray(values) ? values : []).map((x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : 0));
  const sum = v.reduce((s, x) => s + x, 0);
  if (!sum) return v.map(() => 0);
  const exact = v.map((x) => (x / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
  for (let k = 0; left > 0 && k < order.length; k += 1, left -= 1) out[order[k][1]] += 1;
  return out;
}
