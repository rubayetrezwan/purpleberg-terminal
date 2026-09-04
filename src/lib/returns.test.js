import { test } from "node:test";
import assert from "node:assert/strict";
import { periodReturns, TRADING_DAY_OFFSETS, CALENDAR_DAY_OFFSETS } from "./returns.js";

const series = (closes, startDate = "2026-01-01") =>
  closes.map((close, i) => {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    return { date: d.toISOString().slice(0, 10), close };
  });

test("periodReturns computes percentage change at each offset", () => {
  const rows = series([100, 101, 102, 103, 104, 105]);
  const out = periodReturns(rows, { "1D": 1, "2D": 2, "5D": 5 });
  assert.equal(out["1D"].toFixed(4), (100 * (105 - 104) / 104).toFixed(4));
  assert.equal(out["2D"].toFixed(4), (100 * (105 - 103) / 103).toFixed(4));
  assert.equal(out["5D"], 5);
});

test("an offset longer than the series is null rather than wrong", () => {
  const out = periodReturns(series([100, 110]), { "1D": 1, "1Y": 252 });
  assert.equal(out["1D"], 10);
  assert.equal(out["1Y"], null);
});

test("a zero or missing base yields null", () => {
  assert.equal(periodReturns(series([0, 50]), { "1D": 1 })["1D"], null);
  assert.equal(periodReturns([{ date: "2026-01-01", close: null }, { date: "2026-01-02", close: 5 }], { "1D": 1 })["1D"], null);
});

test("year-to-date uses the first close of the current calendar year", () => {
  const rows = [
    { date: "2025-12-30", close: 50 },
    { date: "2026-01-02", close: 100 },
    { date: "2026-03-01", close: 150 },
  ];
  const out = periodReturns(rows, {}, { now: new Date(Date.UTC(2026, 2, 1)) });
  assert.equal(out.YTD, 50);
  // No rows in the current year: YTD is null, never a cross-year number.
  const stale = periodReturns([{ date: "2024-05-05", close: 10 }, { date: "2024-06-06", close: 20 }], {}, { now: new Date(Date.UTC(2026, 0, 5)) });
  assert.equal(stale.YTD, null);
});

test("empty and single-point series return an empty result", () => {
  assert.deepEqual(periodReturns([], { "1D": 1 }), { "1D": null, YTD: null });
  assert.deepEqual(periodReturns([{ date: "2026-01-01", close: 10 }], { "1D": 1 }), { "1D": null, YTD: null });
  assert.deepEqual(periodReturns(null, { "1D": 1 }), { "1D": null, YTD: null });
});

test("the two offset tables cover the same period labels", () => {
  assert.deepEqual(Object.keys(TRADING_DAY_OFFSETS), Object.keys(CALENDAR_DAY_OFFSETS));
  assert.equal(TRADING_DAY_OFFSETS["1Y"], 252);
  assert.equal(CALENDAR_DAY_OFFSETS["1Y"], 365);
});
