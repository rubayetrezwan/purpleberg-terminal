import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRows, visibleWindow, digitIndex, digitRow, maxScrollTop, revealRow } from "./tableUtils.js";

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

test("digitRow picks the row with that number, wherever the table is scrolled", () => {
  // Row labels are the absolute rank ("26)" stays 26 after a scroll), so the
  // 3 key means row 3, not the third row on screen.
  assert.equal(digitRow("3", 700), 2);
  assert.equal(digitRow("9", 5), -1, "no row 9 in a five-row table");
  assert.equal(digitRow("0", 700), -1);
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

test("the scroll clamp counts the sticky header, so the bottom of a long list is reachable", () => {
  // The screener: 248 rows of 24px in a 560px scrollport. The browser stops at
  // 249 * 24 - 560 = 5416; clamping at 5392 shifted every row label by one.
  assert.equal(maxScrollTop(248, 24, 560), 5416);
  assert.equal(maxScrollTop(10, 24, 560), 0);
});


test("revealRow brings a row fully into view below the header and no further", () => {
  // End on the screener: the last row has to sit on the bottom edge, which is
  // the browser's own maximum, not 24px below it.
  assert.equal(revealRow(247, 24, 0, 560), maxScrollTop(248, 24, 560));
  assert.equal(revealRow(0, 24, 500, 560), 0, "back to the top");
  assert.equal(revealRow(30, 24, 720, 560), 720, "row 30 is the first under the header: already in view");
  assert.equal(revealRow(29, 24, 720, 560), 696, "one row up scrolls by exactly one row");
  assert.equal(revealRow(51, 24, 720, 560), 720, "row 51 is the last fully shown");
  assert.equal(revealRow(52, 24, 720, 560), 736, "row 52 is 16px short of the bottom edge");
});
