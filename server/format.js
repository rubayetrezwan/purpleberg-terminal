// Pure helpers for normalising Yahoo Finance's response shapes. Extracted from
// index.js so node:test can exercise them without booting the server (index.js
// self-starts an HTTP listener on import).

// Yahoo wraps most numeric fields as { raw: <number>, fmt: <string> }, but it
// returns a bare {} for fields that exist in a module's schema yet have no value
// for a given symbol. Collapse every non-numeric shape to 0 so an empty {} can
// never leak into an API response (it used to surface as "[object Object]"/NaN
// on the Equity → Ratios tab).
export const raw = (v) => {
  if (v == null) return 0;
  if (typeof v === "object") return typeof v.raw === "number" ? v.raw : 0;
  return v;
};

// ── Finnhub IPO calendar normaliser ─────────────────────
// Finnhub returns { ipoCalendar: [{ date, exchange, name, numberOfShares,
// price, status, symbol, totalSharesValue }] }. Flatten to the row shape the
// IPO screen renders, newest first. Pure so it's unit-testable.
export function normalizeFinnhubIpo(payload) {
  const list = payload && Array.isArray(payload.ipoCalendar) ? payload.ipoCalendar : [];
  return list
    .map((e) => ({
      date: e.date || "",
      name: e.name || e.symbol || "—",
      symbol: e.symbol || "",
      exchange: e.exchange || "—",
      price: e.price || "—", // a range string like "18.00-20.00"
      shares: Number(e.numberOfShares) || 0,
      dealValue: Number(e.totalSharesValue) || 0,
      status: (e.status || "").toLowerCase(),
    }))
    .filter((e) => e.symbol || e.name !== "—")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ── FX cross-rate from a USD-based rate table ───────────
// open.er-api.com returns rates as "units of currency per 1 USD"
// ({ EUR: 0.92, JPY: 156, BDT: 119, ... }). Any pair "BBBQQQ=X" is then
// rate(QQQ) / rate(BBB), with rate("USD") = 1. Returns null if either leg is
// missing so callers can skip rather than emit a bogus 0. Pure / testable.
export function crossRate(pairSymbol, usdRates) {
  if (typeof pairSymbol !== "string" || !usdRates) return null;
  const m = pairSymbol.replace("=X", "").toUpperCase();
  if (m.length !== 6) return null;
  const base = m.slice(0, 3);
  const quote = m.slice(3, 6);
  const r = (c) => (c === "USD" ? 1 : typeof usdRates[c] === "number" ? usdRates[c] : null);
  const rb = r(base);
  const rq = r(quote);
  if (!(rb > 0) || !(rq > 0)) return null;
  return rq / rb;
}
