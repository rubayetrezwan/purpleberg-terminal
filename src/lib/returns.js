import { ET } from "./session.js";

// Period returns from a daily close series, as percentages.
// Equities and futures trade ~252 days a year, so their offsets are in
// trading days; crypto trades every day, so its offsets are calendar days.
// An offset longer than the loaded window returns null rather than silently
// measuring from the edge of the window.
export const TRADING_DAY_OFFSETS = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };
export const CALENDAR_DAY_OFFSETS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

const yearIn = (date, timeZone) =>
  new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);

const DAY_MS = 86_400_000;
const dayNumber = (iso) => {
  if (typeof iso !== "string") return null;
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? Math.round(t / DAY_MS) : null;
};

// The close `days` calendar days before the last row, found by date rather
// than by counting rows: a series with a missing day, or one thinned for
// drawing, no longer has one row per day, and counting back 365 rows in it
// measured from years too early (ETH 1Y read +490%). The newest row of a
// crypto series is the live price, so a window of N days starts on the day
// after the target: the first row is accepted as the base when it is within
// one day of the target.
function closeDaysBefore(series, days) {
  const n = series.length;
  const lastDay = dayNumber(series[n - 1].date);
  if (lastDay == null) return null;
  const target = lastDay - days;
  for (let i = n - 2; i >= 0; i -= 1) {
    const d = dayNumber(series[i] && series[i].date);
    if (d == null || d > target) continue;
    const c = Number(series[i].close);
    return c > 0 ? c : null;
  }
  const firstDay = dayNumber(series[0] && series[0].date);
  if (firstDay == null || firstDay > target + 1 || n < 2) return null;
  const c = Number(series[0].close);
  return c > 0 ? c : null;
}

// options: { now, timeZone, byDate }. `timeZone` names the calendar the
// series is dated on, which decides which year YTD means. Exchange bars are dated in New
// York and crypto bars in UTC; neither follows the viewer's clock, and at
// 14:00 ET on Dec 31 Dhaka is already in January, which left the last session
// of the year with no YTD. Calendar-day offsets are the crypto series, so
// they default to UTC and to measuring by date.
export function periodReturns(rows, offsets = {}, options = {}) {
  const calendar = offsets === CALENDAR_DAY_OFFSETS;
  const { now = new Date(), timeZone = calendar ? "UTC" : ET, byDate = calendar } = options;
  const series = Array.isArray(rows) ? rows : [];
  const out = {};
  for (const key of Object.keys(offsets)) out[key] = null;
  out.YTD = null;

  const n = series.length;
  if (n < 2) return out;
  const last = Number(series[n - 1] && series[n - 1].close);
  if (!(last > 0)) return out;

  for (const [key, back] of Object.entries(offsets)) {
    let base;
    if (byDate) {
      base = closeDaysBefore(series, back);
    } else {
      if (back >= n) continue;
      base = Number(series[n - 1 - back] && series[n - 1 - back].close);
    }
    if (!(base > 0)) continue;
    out[key] = ((last - base) / base) * 100;
  }

  // YTD is measured from the last close of the previous year, which is the
  // only base that makes it a year-to-date number. A window that does not
  // reach back into last year cannot answer the question: the first row inside
  // this year would just be the edge of the window, so a 3-month window would
  // report its own 3-month return as YTD. Null in that case.
  const prefix = `${yearIn(now, timeZone)}-`;
  const lastDate = series[n - 1] && series[n - 1].date;
  // The series also has to reach into this year. A window that ends before
  // January has no year to date, and comparing its final close with itself
  // would report a confident 0%.
  if (typeof lastDate === "string" && lastDate >= prefix) {
    let lastOfPrevYear = null;
    for (const row of series) {
      if (!row || typeof row.date !== "string") continue;
      if (row.date >= prefix) break;
      const c = Number(row.close);
      if (c > 0) lastOfPrevYear = c;
    }
    if (lastOfPrevYear > 0) out.YTD = ((last - lastOfPrevYear) / lastOfPrevYear) * 100;
  }

  return out;
}

// Period labels in display order, including YTD between 6M and 1Y.
export const PERIOD_ORDER = ["1W", "1M", "3M", "6M", "YTD", "1Y"];
