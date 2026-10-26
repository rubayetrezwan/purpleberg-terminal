import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeToPct, alignTimelines, winnerOf, metricValue,
  statementCurrency, CROSS_CURRENCY_RATIOS, largestRemainder, valueAxis,
} from "./compareUtils.js";

test("normalizeToPct returns 0 for the first point and % change from start for the rest", () => {
  const input = [
    { date: "2025-01-01", close: 100 },
    { date: "2025-01-02", close: 110 },
    { date: "2025-01-03", close: 121 },
  ];
  const out = normalizeToPct(input);
  assert.equal(out.length, 3);
  assert.equal(out[0].date, "2025-01-01");
  assert.equal(out[0].pct, 0);
  assert.equal(out[1].pct, 10);
  assert.equal(out[2].pct, 21);
});

test("normalizeToPct returns an empty array for empty / missing input", () => {
  assert.deepEqual(normalizeToPct([]), []);
  assert.deepEqual(normalizeToPct(null), []);
  assert.deepEqual(normalizeToPct(undefined), []);
});

test("normalizeToPct handles a zero first close by returning all zeros", () => {
  const input = [
    { date: "2025-01-01", close: 0 },
    { date: "2025-01-02", close: 5 },
  ];
  const out = normalizeToPct(input);
  assert.equal(out[0].pct, 0);
  assert.equal(out[1].pct, 0); // guarded division
});

test("alignTimelines outer-joins two normalized series on date", () => {
  const a = [
    { date: "2025-01-01", pct: 0 },
    { date: "2025-01-02", pct: 1 },
    { date: "2025-01-03", pct: 2 },
  ];
  const b = [
    { date: "2025-01-02", pct: 0 },
    { date: "2025-01-03", pct: 3 },
    { date: "2025-01-04", pct: 5 },
  ];
  const out = alignTimelines(a, b);
  assert.equal(out.length, 4);
  assert.deepEqual(out[0], { date: "2025-01-01", a: 0, b: null });
  assert.deepEqual(out[1], { date: "2025-01-02", a: 1, b: 0 });
  assert.deepEqual(out[2], { date: "2025-01-03", a: 2, b: 3 });
  assert.deepEqual(out[3], { date: "2025-01-04", a: null, b: 5 });
});

test("alignTimelines is stable with empty inputs", () => {
  assert.deepEqual(alignTimelines([], []), []);
  assert.deepEqual(alignTimelines(null, null), []);
});

test("winnerOf returns 'a' when a is higher and higherIsBetter is true", () => {
  assert.equal(winnerOf(10, 5, true), "a");
  assert.equal(winnerOf(5, 10, true), "b");
});

test("winnerOf returns 'a' when a is lower and higherIsBetter is false", () => {
  assert.equal(winnerOf(1.2, 2.5, false), "a"); // e.g. P/E — lower is better
  assert.equal(winnerOf(2.5, 1.2, false), "b");
});

test("winnerOf returns null when values are equal or either is missing", () => {
  assert.equal(winnerOf(10, 10, true), null);
  assert.equal(winnerOf(null, 5, true), null);
  assert.equal(winnerOf(5, undefined, true), null);
  assert.equal(winnerOf(0, 5, true), null); // treat 0 as missing
});

test("winnerOf never lights a side when the other is not a number", () => {
  // B's financials still loading or failed: its cell reads "—", so neither wins.
  assert.equal(winnerOf(5, NaN, true), null);
  assert.equal(winnerOf(5, NaN, false), null);
  assert.equal(winnerOf(NaN, 5, true), null);
  assert.equal(winnerOf(NaN, 5, false), null);
  assert.equal(winnerOf(Infinity, 5, true), null);
});

test("winnerOf gives no winner to a non-positive value when lower is better", () => {
  assert.equal(winnerOf(-12, 20, false), null); // loss-maker's P/E is not the cheapest
  assert.equal(winnerOf(20, -3, false), null); // negative book value
  assert.equal(winnerOf(-5, 10, true), "b"); // a negative margin still loses fairly
});

test("metricValue reads numbers, strings and {raw}, with 0 as missing", () => {
  assert.equal(metricValue(12.5), 12.5);
  assert.equal(metricValue("43.1"), 43.1);
  assert.equal(metricValue("-4.0"), -4);
  assert.equal(metricValue({ raw: 1.5 }), 1.5);
  assert.equal(metricValue(0), null);
  assert.equal(metricValue("0"), null);
  assert.equal(metricValue(null), null);
  assert.equal(metricValue(undefined), null);
  assert.equal(metricValue(""), null);
  assert.equal(metricValue("N/A"), null);
});

test("statementCurrency flags an ADR reporting in its home currency", () => {
  assert.equal(statementCurrency({ financialCurrency: "TWD" }, { currency: "USD" }), "TWD");
  assert.equal(statementCurrency({ financialCurrency: "USD" }, { currency: "USD" }), null);
  // Unknown on either side is not a mismatch: the old proxy sent no field.
  assert.equal(statementCurrency({ financialCurrency: "" }, { currency: "USD" }), null);
  assert.equal(statementCurrency({}, { currency: "USD" }), null);
  assert.equal(statementCurrency({ financialCurrency: "TWD" }, null), null);
  assert.equal(statementCurrency(null, null), null);
});

test("CROSS_CURRENCY_RATIOS names the price-over-statement ratios only", () => {
  assert.deepEqual([...CROSS_CURRENCY_RATIOS].sort(), ["evEbitda", "pb", "ps"]);
});

test("valueAxis labels every tick at one precision with distinct text", () => {
  const ax = valueAxis([11.6, 12.4, 13.1, null, NaN]);
  const labels = ax.ticks.map(ax.format);
  assert.deepEqual(labels, ["11.5", "12.0", "12.5", "13.0", "13.5"]);
  assert.equal(new Set(labels).size, labels.length);
  assert.deepEqual(ax.domain, [11.5, 13.5]);
  assert.equal(valueAxis([1200, 1350]).format(1250), "1,250");
  assert.equal(valueAxis([-3, 12], "%").format(-4), "-4%");
});

test("valueAxis falls back to Recharts' auto range with no data", () => {
  const ax = valueAxis([]);
  assert.equal(ax.ticks, undefined);
  assert.deepEqual(ax.domain, ["auto", "auto"]);
});

test("largestRemainder makes rounded shares add up to the total", () => {
  // The proxy's own rounding: 56.4 + 34.7 + 8.9 printed as 57/35/9 = 101.
  assert.deepEqual(largestRemainder([57, 35, 9]), [56, 35, 9]);
  assert.deepEqual(largestRemainder([95, 5, 0]), [95, 5, 0]);
  assert.deepEqual(largestRemainder([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(largestRemainder([3, 5, 2], 10), [3, 5, 2]);
  const r = largestRemainder([7, 11, 13]);
  assert.equal(r.reduce((s, x) => s + x, 0), 100);
});

test("largestRemainder treats missing and negative shares as zero", () => {
  assert.deepEqual(largestRemainder([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(largestRemainder([null, "x", -4, 2]), [0, 0, 0, 100]);
  assert.deepEqual(largestRemainder(null), []);
});
