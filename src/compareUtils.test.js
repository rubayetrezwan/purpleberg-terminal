import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeToPct, alignTimelines, winnerOf } from "./compareUtils.js";

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
