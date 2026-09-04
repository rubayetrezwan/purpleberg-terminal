import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklinePoints } from "./sparklinePath.js";
import { freshnessState } from "./freshness.js";

test("sparklinePoints scales values into the box, centres flat lines, skips junk", () => {
  assert.equal(sparklinePoints([1, 2, 3], 60, 14, 1), "1.0,13.0 30.0,7.0 59.0,1.0");
  assert.equal(sparklinePoints([5, 5], 60, 14, 1), "1.0,7.0 59.0,7.0");
  assert.equal(sparklinePoints([1], 60, 14), "");
  assert.equal(sparklinePoints([1, null, "x", 3], 60, 14, 1), "1.0,13.0 59.0,1.0");
  assert.equal(sparklinePoints(null, 60, 14), "");
});

test("freshnessState labels and staleness", () => {
  const now = 100_000;
  assert.deepEqual(freshnessState(null, now, 15000, true), { label: "LOADING…", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 9000, now, 15000, true), { label: "9s ago", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 50_000, now, 15000, true), { label: "STALE 50s", tone: "warn", stale: true });
  assert.deepEqual(freshnessState(now - 100_000, now, 60000, true), { label: "1m ago", tone: "muted", stale: false });
  assert.deepEqual(freshnessState(now - 9000, now, 15000, false), { label: "OFFLINE", tone: "warn", stale: true });
});
