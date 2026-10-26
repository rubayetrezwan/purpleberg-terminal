// Pure helpers for the IPO screen. No React, no DOM — so node:test can exercise
// them without a UI harness (mirrors compareUtils.js).

/**
 * Attach live quotes to curated IPO rows by ticker.
 * Input:  curated [{ ticker, ... }],  quotes [{ symbol, price, ... }]
 * Output: [{ ...ipo, quote }] where quote is the matching quote object or null
 *         (always null for rows without a ticker, e.g. not-yet-listed names).
 * Non-array inputs are treated as empty.
 */
export function mergeLiveQuotes(curated, quotes) {
  const rows = Array.isArray(curated) ? curated : [];
  const bySym = new Map(
    (Array.isArray(quotes) ? quotes : []).map((q) => [q.symbol, q])
  );
  return rows.map((ipo) => ({
    ...ipo,
    quote: ipo.ticker ? bySym.get(ipo.ticker) || null : null,
  }));
}

/**
 * Best available market value for the "valuation" column.
 * Listed names with a live quote → live market cap; otherwise the curated
 * reported valuation (which may be null for names with no public figure yet).
 */
export function ipoMarketValue(row) {
  if (row && row.quote && row.quote.marketCap > 0) return row.quote.marketCap;
  return (row && row.valuation) ?? null;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * A curated IPO date as a label and the first day after the window it names.
 * The curated list writes every date in one of six forms, from exact to vague:
 *   "2026-06-12" -> "12 JUN 26"    "2026-10" -> "OCT 26"
 *   "2026-Q4"    -> "Q4 26"        "2026-H2" -> "H2 26"
 *   "2026-Q2-Q3" -> "Q2-Q3 26"     "2026"    -> "2026"
 * `end` is a local-time Date; anything unparseable comes back as its own text
 * with no end, so a typo shows rather than vanishing.
 */
export function ipoWindow(date) {
  const s = String(date ?? "").trim();
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return { label: `${m[3]} ${MONTHS[mo - 1]} ${m[1].slice(2)}`, end: new Date(y, mo - 1, d + 1) };
  }
  if ((m = /^(\d{4})-(\d{2})$/.exec(s))) {
    const [y, mo] = [Number(m[1]), Number(m[2])];
    return { label: `${MONTHS[mo - 1]} ${m[1].slice(2)}`, end: new Date(y, mo, 1) };
  }
  if ((m = /^(\d{4})-Q([1-4])(?:-Q([1-4]))?$/.exec(s))) {
    const last = Number(m[3] || m[2]);
    const label = m[3] ? `Q${m[2]}-Q${m[3]} ${m[1].slice(2)}` : `Q${m[2]} ${m[1].slice(2)}`;
    return { label, end: new Date(Number(m[1]), last * 3, 1) };
  }
  if ((m = /^(\d{4})-H([12])$/.exec(s))) {
    return { label: `H${m[2]} ${m[1].slice(2)}`, end: new Date(Number(m[1]), Number(m[2]) * 6, 1) };
  }
  if ((m = /^(\d{4})$/.exec(s))) return { label: m[1], end: new Date(Number(m[1]) + 1, 0, 1) };
  return { label: s.toUpperCase() || "—", end: null };
}

/**
 * The DATE cell for a curated row: { label, note }. A listed row shows when it
 * listed. An expected row adds "EXP", or "PAST DUE" once its whole window has
 * gone by without a listing: a Q2 target still reading "expected" in October
 * would claim a schedule the company no longer keeps.
 */
export function ipoDateCell(row, today = new Date()) {
  const { label, end } = ipoWindow(row && row.date);
  if (String(row && row.status).toLowerCase() !== "expected") return { label, note: "" };
  return { label, note: end && today >= end ? "PAST DUE" : "EXP" };
}
