import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

// Five-day close series for inline sparklines. One module-level cache with a
// 5-minute TTL, so navigating away and back does not refetch, and a small
// concurrency limit so a watchlist of fifty does not fan out at once.
const TTL_MS = 5 * 60_000;
const CONCURRENCY = 4;
const cache = new Map(); // symbol -> { closes: number[], ts: number }

function cached(symbol) {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.closes;
  return null;
}

async function fetchOne(symbol) {
  try {
    const rows = await api.historical(symbol, "5d", "1d");
    const closes = (Array.isArray(rows) ? rows : [])
      .map((d) => Number(d.close))
      .filter((n) => Number.isFinite(n) && n > 0);
    cache.set(symbol, { closes, ts: Date.now() });
  } catch {
    // A missing sparkline renders as the empty placeholder; cache the miss
    // briefly so one bad symbol cannot be retried on every render.
    cache.set(symbol, { closes: [], ts: Date.now() });
  }
}

async function fetchMissing(symbols, isLive) {
  const todo = symbols.filter((s) => cached(s) == null);
  let i = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
    while (i < todo.length && isLive()) {
      const symbol = todo[i];
      i += 1;
      await fetchOne(symbol);
    }
  });
  await Promise.all(workers);
}

// Returns { series: Map<symbol, number[]>, loading }.
export function useSparklines(symbols) {
  const key = (symbols || []).join(",");
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) return undefined;
    let live = true;
    const isLive = () => live;
    if (list.some((s) => cached(s) == null)) {
      setLoading(true);
      fetchMissing(list, isLive).finally(() => {
        if (!live) return;
        setLoading(false);
        setTick((t) => t + 1);
      });
    }
    return () => { live = false; };
  }, [key]);

  const series = useMemo(() => {
    const list = key ? key.split(",") : [];
    const m = new Map();
    for (const s of list) {
      const closes = cached(s);
      if (closes && closes.length) m.set(s, closes);
    }
    return m;
  }, [key, tick]);

  return { series, loading };
}
