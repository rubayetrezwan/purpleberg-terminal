import { test } from "node:test";
import assert from "node:assert/strict";
import { breadth } from "./breadth.js";

const q = (symbol, changePercent, price = 100) => ({ symbol, changePercent, price });

test("breadth counts advancers, decliners, and flats", () => {
  const b = breadth([q("A", 2), q("B", -1), q("C", 0), q("D", 3), q("E", -4)]);
  assert.equal(b.total, 5);
  assert.equal(b.up, 2);
  assert.equal(b.down, 2);
  assert.equal(b.flat, 1);
  assert.equal(b.pctUp, 40);
});

test("breadth reports the median absolute move for odd and even counts", () => {
  assert.equal(breadth([q("A", 1), q("B", -3), q("C", 5)]).medianAbs, 3);
  assert.equal(breadth([q("A", 1), q("B", -3)]).medianAbs, 2);
});

test("breadth names the best and worst mover", () => {
  const b = breadth([q("A", 2), q("B", -6), q("C", 9)]);
  assert.deepEqual(b.best, { symbol: "C", chg: 9 });
  assert.deepEqual(b.worst, { symbol: "B", chg: -6 });
});

test("breadth skips rows without a usable quote", () => {
  const b = breadth([q("A", 2), q("B", null), q("C", undefined), { symbol: "D" }, q("E", 1, 0), null, q("F", NaN)]);
  assert.equal(b.total, 1);
  assert.equal(b.up, 1);
});

test("breadth on an empty list returns zeros and nulls", () => {
  const b = breadth([]);
  assert.deepEqual(b, { total: 0, up: 0, down: 0, flat: 0, pctUp: null, medianAbs: null, best: null, worst: null });
  assert.equal(breadth().total, 0);
});
