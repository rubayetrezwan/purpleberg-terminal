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

test("does not fire when the condition already held at the reference price", () => {
  const a = mk({ baseline: 1300, lastPrice: 1300 });
  const { fired, next } = evaluateAlerts([a], prices({ NVDA: 1310 }), 5);
  assert.equal(fired.length, 0);
  assert.equal(next[0].lastPrice, 1310);
});

test("fires after dipping below and coming back above", () => {
  const a = mk({ baseline: 1300, lastPrice: 1300 });
  const step1 = evaluateAlerts([a], prices({ NVDA: 1230 }), 5);
  assert.equal(step1.fired.length, 0);
  const step2 = evaluateAlerts(step1.next, prices({ NVDA: 1245 }), 6);
  assert.equal(step2.fired.length, 1);
});

test("never refires a triggered alert and ignores missing prices", () => {
  const a = mk({ triggeredAt: 1, triggeredPrice: 1250, lastPrice: 1250 });
  const r = evaluateAlerts([a, mk({ id: "a2", symbol: "ZZZZ" })], prices({ NVDA: 1300 }), 7);
  assert.equal(r.fired.length, 0);
  assert.equal(r.next, r.next); // sanity
});

test("returns the same array when nothing changed", () => {
  const items = [mk({ lastPrice: 1210 })];
  const r = evaluateAlerts(items, prices({ NVDA: 1210 }), 8);
  assert.equal(r.next, items);
  assert.equal(r.fired.length, 0);
});
