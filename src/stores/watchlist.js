import { createStore } from "./createStore.js";
import { normalizeSymbol } from "../lib/ticker.js";

export { normalizeSymbol };

export const WATCHLIST_MAX = 50;
export const WATCHLIST_DEFAULTS = {
  symbols: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "JPM"],
};

export function addToList(list, symbol) {
  const t = normalizeSymbol(symbol);
  if (!t || list.includes(t) || list.length >= WATCHLIST_MAX) return list;
  return [...list, t];
}

export function removeFromList(list, symbol) {
  const t = String(symbol ?? "").trim().toUpperCase();
  return list.filter((s) => s !== t);
}

export function moveInList(list, symbol, dir) {
  const i = list.indexOf(symbol);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Corrupt or foreign data never reaches the app: symbols are re-validated,
// deduplicated, and capped; a non-array falls back to the defaults.
export function sanitizeWatchlist(s) {
  if (!Array.isArray(s.symbols)) return { symbols: [...WATCHLIST_DEFAULTS.symbols] };
  const out = [];
  for (const raw of s.symbols) {
    const t = normalizeSymbol(raw);
    if (t && !out.includes(t) && out.length < WATCHLIST_MAX) out.push(t);
  }
  return { symbols: out };
}

export const watchlist = createStore("watchlist", WATCHLIST_DEFAULTS, { sanitize: sanitizeWatchlist });

export const addSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: addToList(st.symbols, s) }));
export const removeSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: removeFromList(st.symbols, s) }));
export const moveSymbol = (s, dir) => watchlist.update((st) => ({ ...st, symbols: moveInList(st.symbols, s, dir) }));
export const isWatched = (s) => watchlist.get().symbols.includes(String(s ?? "").toUpperCase());
