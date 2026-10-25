import { LRUCache } from "lru-cache";

// The proxy's response cache. Kept out of index.js for the same reason as
// format.js: index.js starts listening on import, so node:test can't load it.

// How long an entry outlives its freshness window, so a failing upstream still
// has the last good answer to fall back on. Freshness itself is judged by the
// entry's `ts`, never by the LRU's TTL: lru-cache drops an expired entry as
// soon as it is read, which would leave nothing to fall back on.
export const STALE_MS = 15 * 60_000;

export function createCache({ max = 2000, staleMs = STALE_MS, now = Date.now } = {}) {
  const cache = new LRUCache({
    max,                    // hard ceiling on keys
    ttl: staleMs,           // per-entry TTL passed to set() wins
    updateAgeOnGet: false,
  });
  // key -> { until, error }: an upstream that just failed is not asked again
  // until `until`, so a rate-limited feed is not kept blocked by our own polls.
  // Bounded too: any valid-looking ticker can create a failing history key.
  const failures = new LRUCache({ max: 2000 });

  function put(key, data, ttlMs, keepMs = staleMs) {
    cache.set(key, { data, ts: now() }, { ttl: ttlMs + keepMs });
  }

  // opts.valid(data): false means the upstream answered but with nothing
  //   usable (an empty list, all zeros). That counts as a failure, so it never
  //   overwrites the last good copy.
  // opts.failTtlMs: after a failure, skip the upstream for this long.
  // opts.staleMs: how long the last good copy is kept past its freshness
  //   window for this key (defaults to the cache-wide grace period).
  function cached(key, ttlMs, fn, opts = {}) {
    const { valid, failTtlMs = 0, staleMs: keepMs = staleMs } = opts;
    const entry = cache.get(key);
    if (entry && now() - entry.ts < ttlMs) return Promise.resolve(entry.data);

    const fallback = (e) => {
      // On upstream error, serve any stale entry we still have.
      const stale = cache.get(key);
      if (stale) return stale.data;
      throw e;
    };

    const failed = failures.get(key);
    if (failed && now() < failed.until) return Promise.resolve().then(() => fallback(failed.error));
    if (failed) failures.delete(key); // expired: dropped so typo'd keys don't pile up

    return Promise.resolve().then(fn).then((data) => {
      if (valid && !valid(data)) throw new Error("upstream returned no usable data");
      failures.delete(key);
      put(key, data, ttlMs, keepMs);
      return data;
    }).catch((e) => {
      if (failTtlMs > 0) failures.set(key, { until: now() + failTtlMs, error: e });
      return fallback(e);
    });
  }

  return { cache, cached, put };
}
