import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { useStore } from "../stores/useStore.js";
import { settings } from "../stores/settings.js";
import { scaleInterval } from "./polling.js";

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

// Note on visibility pausing: each polling hook below inlines its own
// visibilitychange listener so a backgrounded tab stops hammering Yahoo and
// CoinGecko. We tried extracting a shared hook but the double state
// transition (visibility -> interval restart) cost more than the duplication
// saved, so each hook owns its own start/stop pair.

// ── Fetch quotes with auto-refresh ──────────────────────
// Polling pauses while the tab is hidden and resumes immediately on focus.
export function useQuotes(symbols, intervalMs = 15000) {
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [state, setState] = useState({ data: [], loading: true, error: null, updatedAt: null, pollSeq: 0, lastPollOk: null });
  const symbolsKey = symbols.join(",");
  const refetchRef = useRef(null);

  useEffect(() => {
    // No symbols to fetch: clear the loading flag so a caller that starts with
    // an empty list (e.g. an empty portfolio) doesn't hang on "loading" forever.
    if (!symbols.length) { setState((s) => ({ ...s, loading: false })); return undefined; }
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const result = await api.quotes(symbols);
        if (cancelled) return;
        setState((s) => ({
          ...s,
          data: result.length > 0 ? result : s.data, // keep previous rows on an empty payload
          loading: false,
          error: null,
          updatedAt: Date.now(),
          pollSeq: s.pollSeq + 1,
          lastPollOk: true,
        }));
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: e.message, pollSeq: s.pollSeq + 1, lastPollOk: false }));
      }
    };
    refetchRef.current = fetchData;

    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => { if (iv != null) { clearInterval(iv); iv = null; } };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [symbolsKey, effectiveMs]);

  const refetch = useCallback(() => { if (refetchRef.current) refetchRef.current(); }, []);
  return { ...state, refetch, intervalMs: effectiveMs };
}

// ── Fetch historical data ───────────────────────────────
export function useHistorical(symbol, range = "3mo") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!symbol) { setLoading(false); setData([]); return undefined; }
    let cancelled = false;
    setLoading(true);
    api.historical(symbol, range).then((result) => {
      if (!cancelled) { setData(result); setLoading(false); setUpdatedAt(Date.now()); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, range]);

  return { data, loading, updatedAt };
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
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [state, setState] = useState({ data: [], loading: true, error: null, updatedAt: null });
  const symbolsKey = symbols ? symbols.join(",") : "";

  useEffect(() => {
    let cancelled = false;
    let iv = null;
    const fetchData = async () => {
      try {
        const result = await api.news(symbols);
        if (!cancelled) setState({ data: result, loading: false, error: null, updatedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }));
      }
    };
    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => { if (iv != null) { clearInterval(iv); iv = null; } };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [symbolsKey, effectiveMs]);

  return { ...state, intervalMs: effectiveMs };
}


// ── Fetch top-N crypto markets ──────────────────────────
// Polls the Crypto dashboard's ranked list from CoinGecko (via our proxy).
// Same visibility-pause pattern as useQuotes so a backgrounded tab stops
// spending the proxy's rate-limit budget. 60s default aligns with the proxy's
// 120s cache TTL — any faster and we just burn CoinGecko's tight public-tier
// limit without gaining freshness, especially on shared-IP deploys (Render
// free) where 429s are trivially easy to trip.
export function useCryptoMarkets(intervalMs = 60000) {
  const refreshSec = useStore(settings, (s) => s.refreshSec);
  const effectiveMs = scaleInterval(intervalMs, refreshSec);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let iv = null;
    let retryTimer = null;

    // First-load retry: an empty stampede (our own limiter on a page-load
    // burst, or an upstream 429) should not leave the screen empty for a full
    // poll interval. Two short retries before declaring the dashboard empty.
    const fetchData = async (attempt = 0) => {
      try {
        const result = await api.cryptoMarkets();
        if (!cancelled) {
          if (Array.isArray(result) && result.length > 0) setData(result);
          setLoading(false);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        if (attempt < 2) {
          retryTimer = setTimeout(() => fetchData(attempt + 1), 1200 * (attempt + 1));
        } else {
          setLoading(false);
        }
      }
    };

    const start = () => { if (iv != null) return; fetchData(); iv = setInterval(fetchData, effectiveMs); };
    const stop = () => {
      if (iv != null) { clearInterval(iv); iv = null; }
      if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); else start(); };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [effectiveMs]);

  return { data, loading, error, updatedAt, intervalMs: effectiveMs };
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

// ── Fetch live IPO calendar (Finnhub via proxy) ─────────
// Same visibility-pause pattern as the other polls. Slow 30-min interval since
// the proxy caches Finnhub for 6h — the calendar barely moves intraday.
// `configured` is false when no FINNHUB_API_KEY is set server-side, letting the
// screen show an "add a key" note instead of an empty table.
export function useIpoCalendar(intervalMs = 1_800_000) {
  const [events, setEvents] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let iv = null;

    const fetchData = async () => {
      try {
        const res = await api.ipoCalendar();
        if (!cancelled) {
          setConfigured(res?.configured !== false);
          setEvents(Array.isArray(res?.events) ? res.events : []);
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
  }, [intervalMs]);

  return { events, configured, loading };
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
    // Guard the write: localStorage.setItem throws on quota-exceeded or in
    // private-mode browsers. The read side is already guarded; without this the
    // throw would bubble out of the effect and crash the screen.
    try {
      localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(holdings));
    } catch {
      /* storage unavailable / full — keep in-memory state, skip persistence */
    }
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
