import { LRUCache } from "lru-cache";

// The proxy's response cache. Kept out of index.js for the same reason as
// format.js: index.js starts listening on import, so node:test can't load it.

// How long an entry outlives its freshness window, so a failing upstream still
// has the last good answer to fall back on. Freshness itself is judged by the
// entry's `ts`, never by the LRU's TTL: lru-cache drops an expired entry as
// soon as it is read, which would leave nothing to fall back on.
export const STALE_MS = 15 * 60_000;

export function createCache({ max = 2000, staleMs = STALE_MS } = {}) {
  const cache = new LRUCache({
    max,                    // hard ceiling on keys
    ttl: staleMs,           // per-entry TTL passed to set() wins
    updateAgeOnGet: false,
  });

  function put(key, data, ttlMs) {
    cache.set(key, { data, ts: Date.now() }, { ttl: ttlMs + staleMs });
  }

  function cached(key, ttlMs, fn) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
    return fn().then((data) => {
      put(key, data, ttlMs);
      return data;
    }).catch((e) => {
      // On upstream error, serve any stale entry we still have.
      const stale = cache.get(key);
      if (stale) return stale.data;
      throw e;
    });
  }

  return { cache, cached, put };
}
