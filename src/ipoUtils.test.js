import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLiveQuotes, ipoMarketValue } from "./ipoUtils.js";

const curated = [
  { rank: 1, company: "SpaceX", ticker: "SPCX", valuation: 1_770_000_000_000, status: "Listed" },
  { rank: 2, company: "OpenAI", ticker: null, valuation: 1_000_000_000_000, status: "Expected" },
];

test("mergeLiveQuotes attaches the matching quote by ticker", () => {
  const quotes = [{ symbol: "SPCX", price: 201.8, marketCap: 2_658_000_000_000 }];
  const out = mergeLiveQuotes(curated, quotes);
  assert.equal(out[0].quote.price, 201.8);
  assert.equal(out[0].company, "SpaceX"); // original fields preserved
});

test("mergeLiveQuotes leaves tickerless rows with quote=null", () => {
  const out = mergeLiveQuotes(curated, [{ symbol: "SPCX", price: 201.8 }]);
  assert.equal(out[1].quote, null);
});

test("mergeLiveQuotes is stable with non-array inputs", () => {
  assert.deepEqual(mergeLiveQuotes(null, null), []);
  assert.equal(mergeLiveQuotes(curated, null)[0].quote, null);
});

test("ipoMarketValue prefers live market cap when present", () => {
  const row = { quote: { marketCap: 2_658_000_000_000 }, valuation: 1_770_000_000_000 };
  assert.equal(ipoMarketValue(row), 2_658_000_000_000);
});

test("ipoMarketValue falls back to curated valuation without a live cap", () => {
  assert.equal(ipoMarketValue({ quote: null, valuation: 1_000_000_000_000 }), 1_000_000_000_000);
  assert.equal(ipoMarketValue({ quote: { marketCap: 0 }, valuation: 5 }), 5);
  assert.equal(ipoMarketValue({ quote: null, valuation: null }), null);
});
