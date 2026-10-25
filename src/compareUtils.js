// Pure helpers for CompareStocks screen. No React, no DOM — just data.
// Kept out of the component so node:test can exercise them without a UI harness.

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
