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
