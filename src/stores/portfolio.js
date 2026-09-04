import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// transactions: [{ id, date: "YYYY-MM-DD", symbol, side: "buy"|"sell",
//                  shares, price, fees, note? }]
// The old app stored holdings ({symbol, name, shares, avgCost}) under
// purpleberg_portfolio; each becomes one buy dated on migration day.
// Local calendar day, so a 21:00 migration in New York is not dated tomorrow.
export function localYmd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function migratePortfolio(storage, today = new Date()) {
  if (!storage) return null;
  let old = null;
  try { old = JSON.parse(storage.getItem("purpleberg_portfolio") || "null"); } catch { return null; }
  if (!Array.isArray(old) || old.length === 0) return null;
  const date = localYmd(today);
  const transactions = old
    .filter((h) => h && h.symbol && Number(h.shares) > 0 && Number(h.avgCost) > 0)
    .map((h) => ({
      id: newId(),
      date,
      symbol: String(h.symbol).toUpperCase(),
      side: "buy",
      shares: Number(h.shares),
      price: Number(h.avgCost),
      fees: 0,
      note: "imported",
    }));
  return transactions.length ? { transactions } : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isTransaction(t) {
  return Boolean(t) && typeof t === "object" && typeof t.id === "string" && DATE_RE.test(String(t.date))
    && typeof t.symbol === "string" && (t.side === "buy" || t.side === "sell")
    && Number(t.shares) > 0 && Number(t.price) > 0 && Number(t.fees ?? 0) >= 0;
}
export const sanitizePortfolio = (s) => ({ transactions: Array.isArray(s.transactions) ? s.transactions.filter(isTransaction) : [] });

// No automatic migration here: the old Portfolio screen still reads and writes
// purpleberg_portfolio until Plan P3 replaces it. P3 calls migratePortfolio()
// at that cutover, only when this store is still empty, so nothing the user
// enters in the meantime is lost.
export const portfolio = createStore("portfolio", { transactions: [] }, { sanitize: sanitizePortfolio });

export function replaceTransactions(transactions) {
  portfolio.update((s) => ({ ...s, transactions: Array.isArray(transactions) ? transactions : [] }));
}
