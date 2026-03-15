import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";

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
    if (!symbol) return;
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
    if (!symbol) return;
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
