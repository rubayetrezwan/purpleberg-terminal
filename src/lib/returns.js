// Period returns from a daily close series, as percentages.
// Equities and futures trade ~252 days a year, so their offsets are in
// trading days; crypto trades every day, so its offsets are calendar days.
// An offset longer than the loaded window returns null rather than silently
// measuring from the edge of the window.
export const TRADING_DAY_OFFSETS = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };
export const CALENDAR_DAY_OFFSETS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

export function periodReturns(rows, offsets = {}, options = {}) {
  const { now = new Date() } = options;
  const series = Array.isArray(rows) ? rows : [];
  const out = {};
  for (const key of Object.keys(offsets)) out[key] = null;
  out.YTD = null;

  const n = series.length;
  if (n < 2) return out;
  const last = Number(series[n - 1] && series[n - 1].close);
  if (!(last > 0)) return out;

  for (const [key, back] of Object.entries(offsets)) {
    if (back >= n) continue;
    const base = Number(series[n - 1 - back] && series[n - 1 - back].close);
    if (!(base > 0)) continue;
    out[key] = ((last - base) / base) * 100;
  }

  const year = now.getUTCFullYear();
  const first = series.find((d) => d && typeof d.date === "string" && d.date.startsWith(`${year}-`));
  const firstClose = Number(first && first.close);
  if (firstClose > 0) out.YTD = ((last - firstClose) / firstClose) * 100;

  return out;
}

// Period labels in display order, including YTD between 6M and 1Y.
export const PERIOD_ORDER = ["1W", "1M", "3M", "6M", "YTD", "1Y"];
