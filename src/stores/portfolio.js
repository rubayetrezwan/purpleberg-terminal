import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// transactions: [{ id, date: "YYYY-MM-DD", symbol, side: "buy"|"sell",
//                  shares, price, fees, note? }]
// The old app stored holdings ({symbol, name, shares, avgCost}) under
// purpleberg_portfolio; each becomes one buy dated on migration day.
export function migratePortfolio(storage, today = new Date()) {
  if (!storage) return null;
  let old = null;
  try { old = JSON.parse(storage.getItem("purpleberg_portfolio") || "null"); } catch { return null; }
  if (!Array.isArray(old) || old.length === 0) return null;
  const date = today.toISOString().slice(0, 10);
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

export const portfolio = createStore("portfolio", { transactions: [] }, { migrate: migratePortfolio });

export function replaceTransactions(transactions) {
  portfolio.update((s) => ({ ...s, transactions: Array.isArray(transactions) ? transactions : [] }));
}
