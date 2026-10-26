// Spot FX quoting rules and the honest change for a quote. Pure, no React.

// Pip size follows the quote's magnitude, not the currency code: pairs quoted
// in the tens or hundreds (JPY, BDT, INR) move in 0.01, majors in 0.0001.
const bigQuote = (price) => Number(price) >= 20;
export const pipSize = (price) => (bigQuote(price) ? 0.01 : 0.0001);
export const rateDecimals = (price) => (bigQuote(price) ? 2 : 4);

// Decimals for an amount of money in a currency (ISO 4217 minor units). The
// yen has no minor unit in use, so 1,000 USD converts to "156,814 JPY", not
// "156,814.00"; every other currency on this screen is counted in hundredths.
const NO_MINOR_UNIT = new Set(["JPY", "KRW", "CLP", "ISK", "VND"]);
export const amountDecimals = (currency) => (NO_MINOR_UNIT.has(String(currency || "").toUpperCase()) ? 0 : 2);

// "1,000", " 1000.5 " and "1e3" are amounts; "", "-" and "abc" are not.
// Negative amounts are refused: a converter has no use for them.
export function parseAmount(text) {
  const s = String(text == null ? "" : text).replace(/[,\s_]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// A quote with no live session behind it: the market is closed (the weekend,
// or a daily fallback feed), or the day's range is empty. Yahoo then repeats
// the last print with a change measured from its own session open, which on a
// Sunday showed USD/JPY +0.02% after a Friday that fell 0.83%.
export function isIndicative(q) {
  if (!q || !(q.price > 0)) return false;
  const closed = Boolean(q.marketState) && q.marketState !== "REGULAR";
  const emptyRange = !(q.high > 0 && q.low > 0 && q.high > q.low);
  return closed || emptyRange;
}

// The daily close an indicative quote is measured against: the last bar in
// the history, or the one before it when the quote is that last bar (a closed
// market quoting its final print). Rows are oldest first, { date, close }.
export function lastClose(rows, price, pip) {
  const bars = (Array.isArray(rows) ? rows : []).filter((r) => r && Number(r.close) > 0);
  if (!bars.length) return null;
  const last = bars[bars.length - 1];
  const same = Math.abs(Number(last.close) - Number(price)) < pip / 2;
  const bar = same && bars.length > 1 ? bars[bars.length - 2] : last;
  return { close: Number(bar.close), date: bar.date || "" };
}

// The FX session date: Yahoo dates currency bars on the London calendar.
export function fxSessionDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// The last daily close dated before `today`: the previous session's close.
export function closeBefore(rows, today) {
  const bars = (Array.isArray(rows) ? rows : []).filter((r) => r && Number(r.close) > 0 && typeof r.date === "string" && r.date < today);
  if (!bars.length) return null;
  const bar = bars[bars.length - 1];
  return { close: Number(bar.close), date: bar.date };
}

// What the screen shows for a quote. A live quote's change is measured from
// the previous session's daily close, the same close the chart ends on.
// Yahoo's own figure disagreed with its daily bars: GBP/USD read +0.01% from
// the session open after a Friday close of 1.3404 (-0.21%), and thin pairs
// read from a wrong previous close (USD/BDT -1.48% on a day up 1.37%). It is
// used only until the history arrives. An indicative quote is measured
// against the last daily close. `basis` says which close.
export function fxChange(q, rows, now = new Date()) {
  if (!q || !(q.price > 0)) return { indicative: false, change: null, changePercent: null, basis: null };
  if (!isIndicative(q)) {
    const basis = closeBefore(rows, fxSessionDate(now));
    if (!basis) return { indicative: false, change: q.change ?? null, changePercent: q.changePercent ?? null, basis: null };
    const change = q.price - basis.close;
    return { indicative: false, change, changePercent: (change / basis.close) * 100, basis };
  }
  const basis = lastClose(rows, q.price, pipSize(q.price));
  if (!basis) return { indicative: true, change: null, changePercent: null, basis: null };
  const change = q.price - basis.close;
  return { indicative: true, change, changePercent: (change / basis.close) * 100, basis };
}
