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

test("with nothing cached, the upstream error reaches the caller", async () => {
  const { cached } = createCache();
  await assert.rejects(cached("none", 1_000, async () => { throw new Error("down"); }), /down/);
});
