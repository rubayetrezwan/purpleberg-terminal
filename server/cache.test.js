import { test } from "node:test";
import assert from "node:assert/strict";
import { createCache } from "./cache.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("a fresh entry is served without calling the upstream again", async () => {
  const { cached } = createCache();
  let calls = 0;
  const fetcher = async () => { calls += 1; return [1, 2, 3]; };
  assert.deepEqual(await cached("k", 60_000, fetcher), [1, 2, 3]);
  assert.deepEqual(await cached("k", 60_000, fetcher), [1, 2, 3]);
  assert.equal(calls, 1);
});

test("an expired entry is refetched once its freshness window has passed", async () => {
  const { cached } = createCache({ staleMs: 5_000 });
  let calls = 0;
  const fetcher = async () => { calls += 1; return calls; };
  assert.equal(await cached("k", 20, fetcher), 1);
  await sleep(40);
  assert.equal(await cached("k", 20, fetcher), 2);
});

test("a failing upstream falls back to the last good answer after it went stale", async () => {
  // This used to throw: reading the expired entry deleted it, so the catch
  // found nothing to fall back on.
  const { cached } = createCache({ staleMs: 5_000 });
  await cached("quotes", 20, async () => ["AAPL"]);
  await sleep(40);
  const out = await cached("quotes", 20, async () => { throw new Error("Yahoo 429"); });
  assert.deepEqual(out, ["AAPL"]);
});

test("the fallback also holds when the freshness window is longer than the grace period", async () => {
  // FX rates, financials and the IPO calendar are cached for 30 min to 6 h.
  // Their grace period has to come on top of that window, not instead of it.
  const { cached } = createCache({ staleMs: 30 });
  await cached("fx", 50, async () => ({ EUR: 0.92 }));
  await sleep(70);
  const out = await cached("fx", 50, async () => { throw new Error("rates down"); });
  assert.deepEqual(out, { EUR: 0.92 });
});

test("put stores an answer under the same freshness and grace rules", async () => {
  const { cached, put } = createCache({ staleMs: 5_000 });
  put("fin:AAPL", { pe: 30 }, 60_000);
  let calls = 0;
  const out = await cached("fin:AAPL", 60_000, async () => { calls += 1; return {}; });
  assert.deepEqual(out, { pe: 30 });
  assert.equal(calls, 0);
});

test("with nothing cached, the upstream error reaches the caller", async () => {
  const { cached } = createCache();
  await assert.rejects(cached("none", 1_000, async () => { throw new Error("down"); }), /down/);
});
