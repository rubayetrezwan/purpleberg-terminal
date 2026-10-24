import { LRUCache } from "lru-cache";

// The proxy's response cache. Kept out of index.js for the same reason as
// format.js: index.js starts listening on import, so node:test can't load it.

// Every entry is kept at least this long so a failing upstream has a stale
// copy to fall back on. Freshness is judged by `ts`, not by the LRU's TTL:
// lru-cache deletes an expired entry as soon as it is read, so an entry that
// expired after ttlMs was already gone when the catch went looking for it.
export const STALE_MS = 15 * 60_000;

export function createCache({ max = 2000, staleMs = STALE_MS } = {}) {
  const cache = new LRUCache({
    max,                    // hard ceiling on keys
    ttl: staleMs,           // per-entry TTL passed to set() wins
    allowStale: true,       // serve stale on upstream error
    updateAgeOnGet: false,
  });

  function cached(key, ttlMs, fn) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
    return fn().then((data) => {
      cache.set(key, { data, ts: Date.now() }, { ttl: Math.max(ttlMs, staleMs) });
      return data;
    }).catch((e) => {
      // On upstream error, serve any stale entry we still have.
      const stale = cache.get(key);
      if (stale) return stale.data;
      throw e;
    });
  }

  return { cache, cached };
}
