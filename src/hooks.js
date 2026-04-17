import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "./api";

// ── Responsive breakpoint hook ──────────────────────────
// Every mounted screen calls this, so the naive `window.resize` listener
// version spawns N listeners that all fire every pixel of a drag. We cache
// one MediaQueryList per breakpoint so all hook instances share a single
// browser-level observer, and matchMedia only fires when the breakpoint
// actually crosses.
const mqlCache = new Map();
function getMQL(breakpoint) {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  let mql = mqlCache.get(breakpoint);
  if (!mql) {
    mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    mqlCache.set(breakpoint, mql);
  }
  return mql;
}

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    const mql = getMQL(breakpoint);
    return mql ? mql.matches : false;
  });
  useEffect(() => {
    const mql = getMQL(breakpoint);
    if (!mql) return;
    const handler = (e) => setIsMobile(e.matches);
    // Safari <14 uses addListener/removeListener; modern browsers use add/removeEventListener.
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    // Sync in case width changed between mount and effect.
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

// ── Page visibility ─────────────────────────────────────
// Used by polling hooks to skip intervals when the tab is backgrounded.
// Why: otherwise ~12 screens worth of quotes/news/historical keep hammering
// Yahoo Finance while the user is doing something else, wasting the server's
// rate-limit budget and burning the user's battery.
export function usePageVisibility() {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );
  useEffect(() => {
    const handler = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return visible;
}

// ── Fetch quotes with auto-refresh ──────────────────────
// Polling pauses while the tab is hidden and resumes immediately on focus.
export function useQuotes(symbols, intervalMs = 15000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbols.length) return;
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const result = await api.quotes(symbols);
        if (!cancelled) {
          if (result.length > 0) setData(result);
          setLoading(false);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
          // Keep previous data on error - don't clear setData
        }
      }
    };

    const start = () => {
      if (iv != null) return;
      fetchData();
      iv = setInterval(fetchData, intervalMs);
    };
    const stop = () => {
      if (iv != null) { clearInterval(iv); iv = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [symbolsKey, intervalMs]);

  return { data, loading, error };
}

// ── Fetch historical data ───────────────────────────────
export function useHistorical(symbol, range = "3mo") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) { setLoading(false); setData([]); return; }
    let cancelled = false;
    setLoading(true);

    api.historical(symbol, range).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol, range]);

  return { data, loading };
}

// ── Fetch financials ────────────────────────────────────
export function useFinancials(symbol) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) { setLoading(false); setData(null); return; }
    let cancelled = false;
    setLoading(true);

    api.financials(symbol).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol]);

  return { data, loading };
}

// ── Fetch news ──────────────────────────────────────────
// Polling pauses while the tab is hidden and resumes immediately on focus.
export function useNews(symbols, intervalMs = 120000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const result = await api.news(symbols);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    const start = () => {
      if (iv != null) return;
      fetchData();
      iv = setInterval(fetchData, intervalMs);
    };
    const stop = () => {
      if (iv != null) { clearInterval(iv); iv = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [symbols?.join(","), intervalMs]);

  return { data, loading };
}


// ── Fetch top-N crypto markets ──────────────────────────
// Polls the Crypto dashboard's ranked list from CoinGecko (via our proxy).
// Same visibility-pause pattern as useQuotes so a backgrounded tab stops
// spending the proxy's rate-limit budget.
export function useCryptoMarkets(intervalMs = 30000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const result = await api.cryptoMarkets();
        if (!cancelled) {
          if (Array.isArray(result) && result.length > 0) setData(result);
          setLoading(false);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
          // Keep previous data on error so a transient CoinGecko 429 doesn't
          // blank the dashboard while the cache refreshes.
        }
      }
    };

    const start = () => {
      if (iv != null) return;
      fetchData();
      iv = setInterval(fetchData, intervalMs);
    };
    const stop = () => {
      if (iv != null) { clearInterval(iv); iv = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return { data, loading, error };
}

// ── Fetch crypto historical chart ───────────────────────
export function useCryptoChart(id, range = "3mo") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); setData([]); return; }
    let cancelled = false;
    setLoading(true);

    api.cryptoChart(id, range).then((result) => {
      if (!cancelled) {
        setData(Array.isArray(result) ? result : []);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id, range]);

  return { data, loading };
}

// ── Live search with debounce ────────────────────────────
export function useSearch(query, delayMs = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.search(query);
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delayMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, delayMs]);

  return { results, loading };
}

// ── Financials with retry ────────────────────────────────
export function useFinancialsWithRetry(symbol, maxRetries = 2) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) { setLoading(false); setData(null); return; }
    let cancelled = false;
    let attempt = 0;
    setLoading(true);
    setError(null);

    const tryFetch = async () => {
      while (attempt <= maxRetries && !cancelled) {
        try {
          const result = await api.financials(symbol);
          if (!cancelled) {
            // Check if result has actual data (not empty object from server error)
            const hasData = result && (result.profile?.sector || result.quarterlyRevenue?.length || result.ratios?.pe);
            if (hasData) {
              setData(result);
              setError(null);
              setLoading(false);
              return;
            }
            // Got empty result, retry
            attempt++;
            if (attempt <= maxRetries) {
              await new Promise((r) => setTimeout(r, 1500 * attempt));
              continue;
            }
            // All retries exhausted but got empty data
            setData(result);
            setError("limited");
            setLoading(false);
            return;
          }
        } catch (e) {
          attempt++;
          if (attempt > maxRetries && !cancelled) {
            setError(e.message);
            setLoading(false);
            return;
          }
          if (!cancelled) await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    };

    tryFetch();
    return () => { cancelled = true; };
  }, [symbol, maxRetries]);

  return { data, loading, error };
}

// ── Portfolio persistence (localStorage) ────────────────
const PORTFOLIO_KEY = "purpleberg_portfolio";

export function usePortfolio() {
  const [holdings, setHoldings] = useState(() => {
    try {
      const saved = localStorage.getItem(PORTFOLIO_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(holdings));
  }, [holdings]);

  const addHolding = useCallback((symbol, name, shares, avgCost) => {
    setHoldings((prev) => {
      const existing = prev.find((h) => h.symbol === symbol);
      if (existing) {
        const totalShares = existing.shares + shares;
        const totalCost = existing.shares * existing.avgCost + shares * avgCost;
        return prev.map((h) =>
          h.symbol === symbol
            ? { ...h, shares: totalShares, avgCost: totalCost / totalShares }
            : h
        );
      }
      return [...prev, { symbol, name, shares, avgCost }];
    });
  }, []);

  const removeHolding = useCallback((symbol) => {
    setHoldings((prev) => prev.filter((h) => h.symbol !== symbol));
  }, []);

  const clearPortfolio = useCallback(() => setHoldings([]), []);

  return { holdings, addHolding, removeHolding, clearPortfolio };
}
