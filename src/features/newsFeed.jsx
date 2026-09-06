import { createContext, useContext, useMemo } from "react";
import { useNews } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";

// One news poll for the whole app. The feed follows the first four watchlist
// symbols; the old hardcoded six remain the fallback for an empty watchlist.
const DEFAULT_NEWS = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "JPM"];

const NewsContext = createContext({ news: [], loading: true, updatedAt: null, intervalMs: 45000 });

export function NewsProvider({ children }) {
  const watch = useStore(watchlist, (s) => s.symbols);
  const symbols = useMemo(() => (watch.length ? watch.slice(0, 4) : DEFAULT_NEWS), [watch]);
  const { data, loading, updatedAt, intervalMs } = useNews(symbols, 45000);
  const value = useMemo(() => ({ news: data, loading, updatedAt, intervalMs }), [data, loading, updatedAt, intervalMs]);
  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNewsFeed() {
  return useContext(NewsContext);
}
