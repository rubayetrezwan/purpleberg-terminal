import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionHolds, evaluateAlerts } from "./alerts.js";

const mk = (over = {}) => ({
  id: "a1", symbol: "NVDA", op: "above", price: 1240, baseline: 1200, lastPrice: 1200,
  createdAt: 1, triggeredAt: null, triggeredPrice: null, ...over,
});
const prices = (map) => (sym) => (sym in map ? map[sym] : null);

test("conditionHolds", () => {
  assert.equal(conditionHolds("above", 1240, 1240), true);
  assert.equal(conditionHolds("above", 1239.99, 1240), false);
  assert.equal(conditionHolds("below", 100, 100), true);
  assert.equal(conditionHolds("below", 100.01, 100), false);
});

test("fires when the price crosses above the target", () => {
  const { fired, next } = evaluateAlerts([mk()], prices({ NVDA: 1241 }), 99);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].triggeredAt, 99);
  assert.equal(fired[0].triggeredPrice, 1241);
  assert.equal(next[0].triggeredAt, 99);
});

test("fires when the price crosses below the target", () => {
  const a = mk({ op: "below", price: 100, baseline: 105, lastPrice: 105 });
  const { fired } = evaluateAlerts([a], prices({ NVDA: 99.5 }), 5);
  assert.equal(fired.length, 1);
});

test("does not fire, and does not rewrite, while still on the reference side", () => {
  const items = [mk({ baseline: 1300, lastPrice: 1300 })];
  const { fired, next } = evaluateAlerts(items, prices({ NVDA: 1310 }), 5);
  assert.equal(fired.length, 0);
  assert.equal(next, items);
  assert.equal(next[0].lastPrice, 1300);
});

test("records a crossing back to the far side, then fires on the return", () => {
  const a = mk({ baseline: 1300, lastPrice: 1300 });
  const step1 = evaluateAlerts([a], prices({ NVDA: 1230 }), 5);
  assert.equal(step1.fired.length, 0);
  assert.equal(step1.next[0].lastPrice, 1230);
  const step2 = evaluateAlerts(step1.next, prices({ NVDA: 1245 }), 6);
  assert.equal(step2.fired.length, 1);
});

test("an alert without a reference arms on the first price instead of firing", () => {
  const a = mk({ baseline: null, lastPrice: null });
  const armed = evaluateAlerts([a], prices({ NVDA: 1300 }), 5);
  assert.equal(armed.fired.length, 0);
  assert.equal(armed.next[0].lastPrice, 1300);
  const dip = evaluateAlerts(armed.next, prices({ NVDA: 1200 }), 6);
  assert.equal(dip.fired.length, 0);
  const back = evaluateAlerts(dip.next, prices({ NVDA: 1250 }), 7);
  assert.equal(back.fired.length, 1);
});

test("never refires a triggered alert and ignores unusable prices", () => {
  const items = [
    mk({ triggeredAt: 0, triggeredPrice: 1250, lastPrice: 1250 }),
    mk({ id: "a2", symbol: "ZZZZ" }),
    mk({ id: "a3", symbol: "ZERO" }),
    mk({ id: "a4", symbol: "NAN" }),
    mk({ id: "a5", symbol: "INF" }),
    mk({ id: "a6", symbol: "STR" }),
  ];
  const r = evaluateAlerts(items, prices({ NVDA: 1300, ZERO: 0, NAN: NaN, INF: Infinity, STR: "1300" }), 7);
  assert.equal(r.fired.length, 0);
  assert.equal(r.next, items);
});

test("returns the same array when nothing changed", () => {
  const items = [mk({ lastPrice: 1210 })];
  const r = evaluateAlerts(items, prices({ NVDA: 1210 }), 8);
  assert.equal(r.next, items);
  assert.equal(r.fired.length, 0);
});
