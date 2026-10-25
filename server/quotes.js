import { LRUCache } from "lru-cache";
import { STALE_MS } from "./cache.js";

// Per-symbol quote cache for /api/quotes.
//
// Every client polls a slightly different list: the shared universe of about
// 700 stocks plus its own watchlist, alerts, holdings and whatever it has open.
// Caching whole lists meant each distinct list refetched all ~700 from Yahoo
// every 12 seconds, and opening one new ticker did the same. Here each symbol
// is cached on its own, so clients share every fetch and a new ticker costs
// one symbol, not the whole list.
//
// - A symbol is fresh for `ttlMs`; after that it is refetched.
// - Symbols already being fetched by another request are awaited, not fetched
//   twice.
// - When a fetch fails, the last good quote is served for up to `staleMs`.
// - A symbol the upstream did not return is remembered as missing for one
//   freshness window, so a typo is not refetched on every request, but a miss
//   never overwrites an older good quote.
export function createQuoteCache({
  fetchBatch,
  ttlMs = 12_000,
  staleMs = STALE_MS,
  batchSize = 200,
  concurrency = 4,
  max = 5000,
  now = Date.now,
  onError = () => {},
}) {
  const entries = new LRUCache({ max });
  const inflight = new Map();

  const isFresh = (s, t) => {
    const e = entries.peek(s);
    return Boolean(e) && t - e.ts < ttlMs;
  };

  async function runBatch(batch) {
    let rows;
    try {
      rows = await fetchBatch(batch);
    } catch (e) {
      onError(e, batch);
      return;
    }
    const got = new Map();
    for (const q of rows || []) {
      // Yahoo answers a delisted ticker (TWTR, SIVB) with a stub whose every
      // field is 0. No price means no quote.
      if (q && q.symbol != null && Number(q.regularMarketPrice) > 0) got.set(String(q.symbol).toUpperCase(), q);
    }
    const ts = now();
    for (const s of batch) {
      if (got.has(s)) entries.set(s, { quote: got.get(s), ts });
      else if (!entries.peek(s)?.quote) entries.set(s, { quote: null, ts });
    }
  }

  async function get(symbols) {
    const t = now();
    const need = symbols.filter((s) => !isFresh(s, t) && !inflight.has(s));
    if (need.length) {
      const batches = [];
      for (let i = 0; i < need.length; i += batchSize) batches.push(need.slice(i, i + batchSize));
      const work = mapWithConcurrency(batches, concurrency, runBatch);
      for (const s of need) inflight.set(s, work);
      work.finally(() => {
        for (const s of need) if (inflight.get(s) === work) inflight.delete(s);
      });
    }
    const waits = new Set(symbols.map((s) => inflight.get(s)).filter(Boolean));
    await Promise.all(waits);

    const end = now();
    const out = [];
    for (const s of symbols) {
      const e = entries.peek(s);
      if (e && e.quote && end - e.ts < staleMs) out.push(e.quote);
    }
    return out;
  }

  return { get, entries };
}

// Run `fn` over `items` with at most `limit` calls in flight.
export async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
