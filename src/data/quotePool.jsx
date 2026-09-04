import { createContext, useContext, useEffect, useMemo } from "react";
import { US_STOCKS } from "../config.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { alerts } from "../stores/alerts.js";
import { portfolio } from "../stores/portfolio.js";
import { poolExtras, retainSymbol, releaseSymbol } from "./poolExtras.js";
import { dedupeSymbols } from "./symbols.js";
import { reportPoll } from "./feedStatus.js";
import { useQuotes } from "./hooks.js";

// One poll for everything equity-shaped the app needs: the tracked 250, the
// watchlist, alert and portfolio symbols, and ad-hoc extras. Screens read
// quotes from here instead of polling on their own.
export const POOL_FIXED = ["^GSPC"]; // drives the session clock's market state

const PoolContext = createContext(null);

export function QuotePoolProvider({ children }) {
  const watch = useStore(watchlist, (s) => s.symbols);
  const alertItems = useStore(alerts, (s) => s.items);
  const txs = useStore(portfolio, (s) => s.transactions);
  const extras = useStore(poolExtras, (s) => s.counts);

  const symbols = useMemo(
    () => dedupeSymbols([POOL_FIXED, US_STOCKS, watch, alertItems.map((a) => a.symbol), txs.map((t) => t.symbol), Object.keys(extras)]),
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

  const value = useMemo(
    () => ({ bySymbol, list: q.data, loading: q.loading, error: q.error, updatedAt: q.updatedAt, intervalMs: q.intervalMs, refetch: q.refetch, symbols }),
    [bySymbol, q.data, q.loading, q.error, q.updatedAt, q.intervalMs, q.refetch, symbols]
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
  return pool.bySymbol.get(String(symbol).toUpperCase()) ?? null;
}

export function usePoolQuotes(symbols) {
  const pool = useQuotePool();
  return useMemo(() => (symbols || []).map((s) => pool.bySymbol.get(s)).filter(Boolean), [pool.bySymbol, symbols]);
}

// Keep an ad-hoc symbol in the pool while the calling component is mounted.
export function usePoolExtra(symbol) {
  useEffect(() => {
    if (!symbol) return undefined;
    retainSymbol(symbol);
    return () => releaseSymbol(symbol);
  }, [symbol]);
}
