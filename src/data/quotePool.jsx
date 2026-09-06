import { createContext, useContext, useEffect, useMemo } from "react";
import { US_STOCKS } from "../config.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { alerts } from "../stores/alerts.js";
import { portfolio } from "../stores/portfolio.js";
import { poolExtras, retainSymbol, releaseSymbol } from "./poolExtras.js";
import { dedupeSymbols, POOL_FIXED } from "./symbols.js";
import { reportPoll } from "./feedStatus.js";
import { useQuotes } from "./hooks.js";

// One poll for everything equity-shaped the app needs: the shell's fixed
// symbols, the user's watchlist, alert and portfolio symbols, ad-hoc extras,
// and finally the tracked 250. User-owned symbols come first so the proxy's
// 300-symbol cap can only ever trim the tail of the static list.
const PoolContext = createContext(null);

export function QuotePoolProvider({ children }) {
  const watch = useStore(watchlist, (s) => s.symbols);
  const alertItems = useStore(alerts, (s) => s.items);
  const txs = useStore(portfolio, (s) => s.transactions);
  const extras = useStore(poolExtras, (s) => s.counts);

  const symbols = useMemo(
    () => dedupeSymbols([POOL_FIXED, watch, alertItems.map((a) => a.symbol), txs.map((t) => t.symbol), Object.keys(extras), US_STOCKS]),
    [watch, alertItems, txs, extras]
  );

  const q = useQuotes(symbols, 15000);

  useEffect(() => {
    if (q.pollSeq > 0) reportPoll(q.lastPollOk);
  }, [q.pollSeq, q.lastPollOk]);

  const bySymbol = useMemo(() => {
    const m = new Map();
    for (const row of q.data) m.set(row.symbol, row);
    return m;
  }, [q.data]);

  // Index rows (^GSPC) are for the shell only; screens read `equities`.
  const equities = useMemo(() => q.data.filter((row) => !String(row.symbol || "").startsWith("^")), [q.data]);

  const value = useMemo(
    () => ({ bySymbol, list: q.data, equities, loading: q.loading, error: q.error, updatedAt: q.updatedAt, intervalMs: q.intervalMs, refetch: q.refetch, symbols }),
    [bySymbol, q.data, equities, q.loading, q.error, q.updatedAt, q.intervalMs, q.refetch, symbols]
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function useQuotePool() {
  const v = useContext(PoolContext);
  if (!v) throw new Error("useQuotePool must be used inside QuotePoolProvider");
  return v;
}

export function useQuote(symbol) {
  const pool = useQuotePool();
  if (!symbol) return null;
  return pool.bySymbol.get(String(symbol).trim().toUpperCase()) ?? null;
}

// Rows for the given symbols, in order, skipping any not yet in the pool.
// Keyed on the joined string so callers may pass a fresh array literal.
export function usePoolQuotes(symbols) {
  const pool = useQuotePool();
  const key = (symbols || []).map((s) => String(s).trim().toUpperCase()).join(",");
  return useMemo(
    () => (key ? key.split(",") : []).map((s) => pool.bySymbol.get(s)).filter(Boolean),
    [pool.bySymbol, key]
  );
}

// Keep an ad-hoc symbol in the pool while the calling component is mounted.
// Joining the pool restarts its poll, so the first price arrives after one
// full round trip; that is the accepted cost of a single shared poll.
export function usePoolExtra(symbol) {
  const sym = symbol ? String(symbol).trim().toUpperCase() : null;
  useEffect(() => {
    if (!sym) return undefined;
    retainSymbol(sym);
    return () => releaseSymbol(sym);
  }, [sym]);
}
