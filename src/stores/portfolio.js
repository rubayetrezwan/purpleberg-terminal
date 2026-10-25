import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";
import { tradeDate } from "../lib/session.js";

// transactions: [{ id, date: "YYYY-MM-DD", symbol, side: "buy"|"sell",
//                  shares, price, fees, note? }]
// The old app stored holdings ({symbol, name, shares, avgCost}) under
// purpleberg_portfolio; each becomes one buy dated on migration day.
// localYmd is re-exported for callers that already import it from here.
export { localYmd } from "../lib/portfolio.js";

export function migratePortfolio(storage, today = new Date()) {
  if (!storage) return null;
  let old = null;
  try { old = JSON.parse(storage.getItem("purpleberg_portfolio") || "null"); } catch { return null; }
  if (!Array.isArray(old) || old.length === 0) return null;
  // Migration day is the New York trade date, the same default the form uses.
  // East of New York the local date runs a day ahead through the US evening,
  // which would date these buys after today in New York, often on a Saturday.
  const date = tradeDate(today);
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

// Migration is not automatic: the Portfolio screen calls migratePortfolio() on
// first mount, and only while this store is still empty, so a stale
// purpleberg_portfolio key can never overwrite transactions entered since.
export const portfolio = createStore("portfolio", { transactions: [] }, { sanitize: sanitizePortfolio });

export function replaceTransactions(transactions) {
  portfolio.update((s) => ({ ...s, transactions: Array.isArray(transactions) ? transactions : [] }));
}

// The screen passes a transaction without an id; the store owns identity so two
// identical trades on the same day stay separately deletable.
export function addTransaction(t) {
  const row = { id: newId(), fees: 0, ...t };
  portfolio.update((s) => ({ ...s, transactions: [...s.transactions, row] }));
  return row;
}

export function appendTransactions(rows) {
  const added = (Array.isArray(rows) ? rows : []).map((t) => ({ id: newId(), fees: 0, ...t }));
  if (added.length) portfolio.update((s) => ({ ...s, transactions: [...s.transactions, ...added] }));
  return added;
}

export function removeTransaction(id) {
  portfolio.update((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
}
