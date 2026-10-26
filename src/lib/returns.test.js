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

test("year-to-date runs from the previous year's last close", () => {
  const rows = [
    { date: "2025-12-30", close: 50 },
    { date: "2026-01-02", close: 100 },
    { date: "2026-03-01", close: 150 },
  ];
  const out = periodReturns(rows, {}, { now: new Date(2026, 2, 1) });
  assert.equal(out.YTD, 200, "150 against the 50 that closed 2025, not against January's 100");
  // Nothing from the previous year in the window: YTD has no base, and the
  // first row of this year is the edge of the window rather than a year start.
  const stale = periodReturns([{ date: "2024-05-05", close: 10 }, { date: "2024-06-06", close: 20 }], {}, { now: new Date(2026, 0, 5) });
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

test("YTD measures from last year's final close, not the edge of the window", () => {
  const rows = [
    { date: "2025-12-30", close: 100 },
    { date: "2025-12-31", close: 200 }, // last close of the previous year
    { date: "2026-01-02", close: 220 },
    { date: "2026-06-01", close: 260 },
  ];
  const out = periodReturns(rows, { "1D": 1 }, { now: new Date(2026, 5, 1) });
  assert.equal(out.YTD, 30, "260 against 200, not against 220");
});

test("YTD for an exchange series follows the New York year, not the viewer's", () => {
  // 14:00 ET on Dec 31 is already Jan 1 in Dhaka; the session is still 2025's.
  const now = new Date("2025-12-31T19:00:00Z");
  const rows = [
    { date: "2024-12-31", close: 100 },
    { date: "2025-06-02", close: 110 },
    { date: "2025-12-31", close: 120 },
  ];
  assert.equal(periodReturns(rows, TRADING_DAY_OFFSETS, { now }).YTD, 20);
  // Just after the New York midnight the year has turned and has no session yet.
  assert.equal(periodReturns(rows, TRADING_DAY_OFFSETS, { now: new Date("2026-01-01T05:30:00Z") }).YTD, null);
});

test("YTD for a crypto series follows the UTC year its bars are dated in", () => {
  // 00:30 UTC on Jan 1: the new UTC bar exists while New York is still in Dec 31.
  const now = new Date("2026-01-01T00:30:00Z");
  const rows = [
    { date: "2024-12-31", close: 50 },
    { date: "2025-12-31", close: 100 },
    { date: "2026-01-01", close: 105 },
  ];
  assert.equal(periodReturns(rows, CALENDAR_DAY_OFFSETS, { now }).YTD, 5);
  assert.equal(periodReturns(rows, {}, { now, timeZone: "UTC" }).YTD, 5);
});

const daily = (from, closes) => closes.map((close, i) => {
  const d = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000);
  return { date: d.toISOString().slice(0, 10), close };
});

test("calendar-day returns are measured by date, not by counting rows", () => {
  // Ten years of daily closes, then every 6th row only, as a chart thins it.
  const full = daily("2016-10-25", Array.from({ length: 3653 }, (_, i) => 100 + i));
  const thinned = full.filter((_, i) => (full.length - 1 - i) % 6 === 0);
  const a = periodReturns(full, CALENDAR_DAY_OFFSETS);
  const b = periodReturns(thinned, CALENDAR_DAY_OFFSETS);
  const last = 100 + 3652;
  assert.equal(a["1Y"].toFixed(6), ((last / (last - 365) - 1) * 100).toFixed(6));
  // Counting 365 rows back in the thinned series would reach six years back.
  assert.ok(Math.abs(b["1Y"] - a["1Y"]) < 0.5, `thinned 1Y ${b["1Y"]} vs full ${a["1Y"]}`);
});

test("a window of N days whose newest row is live still has its N-day return", () => {
  // CoinGecko's 1y window: 365 rows, first one 364 days before the live row.
  const rows = daily("2025-10-26", Array.from({ length: 365 }, (_, i) => (i === 0 ? 4000 : i === 364 ? 2400 : 3000)));
  const out = periodReturns(rows, CALENDAR_DAY_OFFSETS);
  assert.equal(out["1Y"], -40, "start to end of the 1Y chart");
  // A window two days short of the period has no base.
  const short = daily("2025-10-28", Array.from({ length: 363 }, () => 10));
  assert.equal(periodReturns(short, CALENDAR_DAY_OFFSETS)["1Y"], null);
});

test("a gap in the dates falls back to the last close on or before the target", () => {
  const rows = [
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-05", close: 120 }, // Jan 2-4 missing
    { date: "2026-01-09", close: 150 },
  ];
  assert.equal(periodReturns(rows, { "1W": 7 }, { byDate: true })["1W"], 50, "Jan 2 target resolves to Jan 1");
});

test("YTD is null when the window does not reach into last year", () => {
  // A 3-month window opened inside the year: the first row is the edge of the
  // window, so calling its return "YTD" would be a different number wearing
  // the wrong label.
  const rows = [
    { date: "2026-06-01", close: 100 },
    { date: "2026-07-01", close: 120 },
    { date: "2026-08-05", close: 130 },
  ];
  const out = periodReturns(rows, { "1M": 1 }, { now: new Date(2026, 7, 5) });
  assert.equal(out.YTD, null);
});
