import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLiveQuotes, ipoMarketValue, ipoWindow, ipoDateCell } from "./ipoUtils.js";
import { IPO_2026 } from "./config.js";

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

test("ipoWindow labels every curated date form the same terse way", () => {
  assert.equal(ipoWindow("2026-06-12").label, "12 JUN 26");
  assert.equal(ipoWindow("2026-06-04").label, "04 JUN 26");
  assert.equal(ipoWindow("2026-10").label, "OCT 26");
  assert.equal(ipoWindow("2026-Q4").label, "Q4 26");
  assert.equal(ipoWindow("2026-H2").label, "H2 26");
  assert.equal(ipoWindow("2026-Q2-Q3").label, "Q2-Q3 26");
  assert.equal(ipoWindow("2026").label, "2026");
  assert.equal(ipoWindow("soon").label, "SOON");
  assert.equal(ipoWindow("soon").end, null);
});

test("ipoWindow ends each window on the first day after it", () => {
  const day = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  assert.deepEqual(day(ipoWindow("2026-06-12").end), [2026, 6, 13]);
  assert.deepEqual(day(ipoWindow("2026-12").end), [2027, 1, 1]);
  assert.deepEqual(day(ipoWindow("2026-Q2").end), [2026, 7, 1]);
  assert.deepEqual(day(ipoWindow("2026-Q2-Q3").end), [2026, 10, 1]);
  assert.deepEqual(day(ipoWindow("2026-H1").end), [2026, 7, 1]);
  assert.deepEqual(day(ipoWindow("2026").end), [2027, 1, 1]);
});

test("ipoDateCell marks an expected window that has gone by as PAST DUE", () => {
  const oct25 = new Date(2026, 9, 25);
  assert.deepEqual(ipoDateCell({ date: "2026-Q2", status: "Expected" }, oct25), { label: "Q2 26", note: "PAST DUE" });
  assert.deepEqual(ipoDateCell({ date: "2026-Q2-Q3", status: "Expected" }, oct25), { label: "Q2-Q3 26", note: "PAST DUE" });
  assert.deepEqual(ipoDateCell({ date: "2026-10", status: "Expected" }, oct25), { label: "OCT 26", note: "EXP" });
  assert.deepEqual(ipoDateCell({ date: "2026-Q4", status: "Expected" }, oct25), { label: "Q4 26", note: "EXP" });
  assert.deepEqual(ipoDateCell({ date: "2026-10", status: "Expected" }, new Date(2026, 10, 1)), { label: "OCT 26", note: "PAST DUE" });
  // A listed date is history, never late.
  assert.deepEqual(ipoDateCell({ date: "2026-06-12", status: "Listed" }, oct25), { label: "12 JUN 26", note: "" });
});

test("every curated IPO date is in a form ipoWindow understands", () => {
  for (const row of IPO_2026) assert.ok(ipoWindow(row.date).end, `${row.company}: ${row.date}`);
});
