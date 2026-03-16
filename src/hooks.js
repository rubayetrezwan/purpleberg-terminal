import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "./api";

// ── Responsive breakpoint hook ──────────────────────────
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// ── Fetch quotes with auto-refresh ──────────────────────
export function useQuotes(symbols, intervalMs = 15000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbols.length) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const result = await api.quotes(symbols);
        if (!cancelled && result.length > 0) {
          setData(result);
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

    fetchData();
    const iv = setInterval(fetchData, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(iv);
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
export function useNews(symbols, intervalMs = 120000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

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

    fetchData();
    const iv = setInterval(fetchData, intervalMs);
    return () => { cancelled = true; clearInterval(iv); };
  }, [symbols?.join(","), intervalMs]);

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
