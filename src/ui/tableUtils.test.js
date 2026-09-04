import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRows, visibleWindow, digitIndex } from "./tableUtils.js";

const cols = [{ key: "sym" }, { key: "px" }, { key: "name", sortValue: (r) => r.name.toLowerCase() }];
const rows = [
  { sym: "B", px: 2, name: "beta" },
  { sym: "A", px: null, name: "Alpha" },
  { sym: "C", px: 1, name: "gamma" },
  { sym: "D", px: 2, name: "delta" },
];
const syms = (list) => list.map((r) => r.sym);

test("sortRows: numeric desc and asc, stable, missing values last either way", () => {
  assert.deepEqual(syms(sortRows(rows, cols, { key: "px", dir: "desc" })), ["B", "D", "C", "A"]);
  assert.deepEqual(syms(sortRows(rows, cols, { key: "px", dir: "asc" })), ["C", "B", "D", "A"]);
});

test("sortRows: strings through sortValue, case-insensitive", () => {
  assert.deepEqual(syms(sortRows(rows, cols, { key: "name", dir: "asc" })), ["A", "B", "D", "C"]);
});

test("sortRows: no sort or unknown key returns the input array itself", () => {
  assert.equal(sortRows(rows, cols, null), rows);
  assert.equal(sortRows(rows, cols, { key: "nope", dir: "asc" }), rows);
});

test("visibleWindow", () => {
  assert.deepEqual(visibleWindow(0, 24, 1000, 480, 8), { start: 0, end: 28 });
  assert.deepEqual(visibleWindow(2400, 24, 1000, 480, 8), { start: 92, end: 128 });
  assert.deepEqual(visibleWindow(999_999, 24, 50, 480, 8), { start: 50, end: 50 });
  assert.deepEqual(visibleWindow(0, 24, 10, 480, 8), { start: 0, end: 10 });
});

test("digitIndex maps 1-9 to 0-8", () => {
  assert.equal(digitIndex("1"), 0);
  assert.equal(digitIndex("9"), 8);
  assert.equal(digitIndex("0"), -1);
  assert.equal(digitIndex("a"), -1);
  assert.equal(digitIndex("Enter"), -1);
});

test("sortRows: NaN and undefined count as missing, input is not mutated, dir defaults to desc", () => {
  const data = [{ sym: "A", px: NaN }, { sym: "B", px: 3 }, { sym: "C", px: undefined }, { sym: "D", px: 1 }];
  const snapshot = JSON.stringify(data);
  assert.deepEqual(syms(sortRows(data, cols, { key: "px", dir: "asc" })), ["D", "B", "A", "C"]);
  assert.deepEqual(syms(sortRows(data, cols, { key: "px" })), ["B", "D", "A", "C"]);
  assert.equal(JSON.stringify(data), snapshot);
  const inf = [{ sym: "X", px: Infinity }, { sym: "Y", px: Infinity }, { sym: "Z", px: 1 }];
  assert.deepEqual(syms(sortRows(inf, cols, { key: "px", dir: "desc" })), ["X", "Y", "Z"]);
});

test("visibleWindow with no rows", () => {
  assert.deepEqual(visibleWindow(0, 24, 0, 480, 8), { start: 0, end: 0 });
});
