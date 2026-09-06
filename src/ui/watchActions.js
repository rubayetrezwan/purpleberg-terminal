import { watchlist, addToList, removeFromList, normalizeSymbol, WATCHLIST_MAX } from "../stores/watchlist.js";
import { toast } from "./toasts.js";

// Star toggle used by Ticker, quick-look, and screen headers. Returns the new
// membership. Every change gets a toast with Undo.
export function toggleWatch(symbol) {
  const sym = normalizeSymbol(symbol);
  if (!sym) return false;
  const was = watchlist.get().symbols.includes(sym);
  watchlist.update((s) => ({ ...s, symbols: was ? removeFromList(s.symbols, sym) : addToList(s.symbols, sym) }));
  const isIn = watchlist.get().symbols.includes(sym);
  if (!was && !isIn) {
    toast({ tone: "warn", title: "WATCHLIST FULL", body: `${sym} not added (max ${WATCHLIST_MAX})` });
    return false;
  }
  toast({
    title: was ? `${sym} REMOVED FROM WATCHLIST` : `${sym} ADDED TO WATCHLIST`,
    actions: [{
      label: "UNDO",
      run: () => watchlist.update((s) => ({ ...s, symbols: was ? addToList(s.symbols, sym) : removeFromList(s.symbols, sym) })),
    }],
  });
  return isIn;
}
