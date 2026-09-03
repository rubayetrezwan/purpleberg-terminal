import { createStore } from "./createStore.js";

export const WATCHLIST_MAX = 50;
export const WATCHLIST_DEFAULTS = {
  symbols: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "JPM"],
};

const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

export function normalizeSymbol(s) {
  const t = String(s ?? "").trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

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

export const watchlist = createStore("watchlist", WATCHLIST_DEFAULTS);

export const addSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: addToList(st.symbols, s) }));
export const removeSymbol = (s) => watchlist.update((st) => ({ ...st, symbols: removeFromList(st.symbols, s) }));
export const moveSymbol = (s, dir) => watchlist.update((st) => ({ ...st, symbols: moveInList(st.symbols, s, dir) }));
export const isWatched = (s) => watchlist.get().symbols.includes(String(s ?? "").toUpperCase());
