import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuoteCache, mapWithConcurrency } from "./quotes.js";

const quote = (symbol, price = 100) => ({ symbol, regularMarketPrice: price });

// A fake upstream that records each batch it was asked for.
function upstream(prices = {}) {
  const calls = [];
  const fetchBatch = async (batch) => {
    calls.push(batch);
    return batch.filter((s) => s in prices).map((s) => quote(s, prices[s]));
  };
  return { calls, fetchBatch };
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("fresh symbols are served from the cache and only the new one is fetched", async () => {
  const up = upstream({ AAPL: 1, MSFT: 2, NVDA: 3 });
  const c = clock();
  const qc = createQuoteCache({ fetchBatch: up.fetchBatch, now: c.now });
  assert.deepEqual((await qc.get(["AAPL", "MSFT"])).map((q) => q.symbol), ["AAPL", "MSFT"]);
  assert.deepEqual((await qc.get(["AAPL", "MSFT", "NVDA"])).map((q) => q.symbol), ["AAPL", "MSFT", "NVDA"]);
  assert.deepEqual(up.calls, [["AAPL", "MSFT"], ["NVDA"]]);
});

test("a symbol is refetched once its freshness window has passed", async () => {
  const up = upstream({ AAPL: 1 });
  const c = clock();
  const qc = createQuoteCache({ fetchBatch: up.fetchBatch, now: c.now, ttlMs: 10 });
  await qc.get(["AAPL"]);
  c.advance(5);
  await qc.get(["AAPL"]);
  assert.equal(up.calls.length, 1);
  c.advance(10);
  await qc.get(["AAPL"]);
  assert.equal(up.calls.length, 2);
});

test("long lists are split into batches", async () => {
  const symbols = Array.from({ length: 450 }, (_, i) => `S${i}`);
  const up = upstream(Object.fromEntries(symbols.map((s) => [s, 1])));
  const qc = createQuoteCache({ fetchBatch: up.fetchBatch, batchSize: 200 });
  const out = await qc.get(symbols);
  assert.equal(out.length, 450);
  assert.deepEqual(up.calls.map((b) => b.length), [200, 200, 50]);
});

test("two overlapping requests share one fetch", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const calls = [];
  const fetchBatch = async (batch) => { calls.push(batch); await gate; return batch.map((s) => quote(s)); };
  const qc = createQuoteCache({ fetchBatch });
  const a = qc.get(["AAPL", "MSFT"]);
  const b = qc.get(["MSFT", "AAPL"]);
  release();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(calls.length, 1);
  assert.deepEqual(ra.map((q) => q.symbol), ["AAPL", "MSFT"]);
  assert.deepEqual(rb.map((q) => q.symbol), ["MSFT", "AAPL"]);
});

test("a failing upstream serves the last good quote until it is too old", async () => {
  let fail = false;
  const fetchBatch = async (batch) => { if (fail) throw new Error("Yahoo 429"); return batch.map((s) => quote(s, 5)); };
  const errors = [];
  const c = clock();
  const qc = createQuoteCache({ fetchBatch, now: c.now, ttlMs: 10, staleMs: 100, onError: (e) => errors.push(e.message) });
  await qc.get(["AAPL"]);
  fail = true;
  c.advance(50);
  assert.deepEqual((await qc.get(["AAPL"])).map((q) => q.regularMarketPrice), [5]);
  assert.deepEqual(errors, ["Yahoo 429"]);
  c.advance(60);
  assert.deepEqual(await qc.get(["AAPL"]), []);
});

test("an unknown symbol is remembered as missing and not refetched while fresh", async () => {
  const up = upstream({ AAPL: 1 });
  const c = clock();
  const qc = createQuoteCache({ fetchBatch: up.fetchBatch, now: c.now, ttlMs: 10 });
  assert.deepEqual((await qc.get(["AAPL", "ZZZZ"])).map((q) => q.symbol), ["AAPL"]);
  await qc.get(["ZZZZ"]);
  assert.equal(up.calls.length, 1);
});

test("a miss never overwrites an older good quote", async () => {
  let drop = false;
  const fetchBatch = async (batch) => (drop ? [] : batch.map((s) => quote(s, 7)));
  const c = clock();
  const qc = createQuoteCache({ fetchBatch, now: c.now, ttlMs: 10, staleMs: 1000 });
  await qc.get(["AAPL"]);
  drop = true;
  c.advance(20);
  assert.deepEqual((await qc.get(["AAPL"])).map((q) => q.regularMarketPrice), [7]);
});

test("rows without a price are treated as missing, not as a zero quote", async () => {
  const fetchBatch = async () => [{ symbol: "ZZZZ", quoteType: "NONE" }, quote("TWTR", 0), quote("AAPL")];
  const qc = createQuoteCache({ fetchBatch });
  assert.deepEqual((await qc.get(["AAPL", "ZZZZ", "TWTR"])).map((q) => q.symbol), ["AAPL"]);
});

test("mapWithConcurrency keeps order and never exceeds the limit", async () => {
  let active = 0;
  let peak = 0;
  const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, n));
    active -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
  assert.equal(peak, 2);
});
