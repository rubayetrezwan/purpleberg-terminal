import { test } from "node:test";
import assert from "node:assert/strict";
import { pushLayer, popLayer, closeTopLayer, layerCount, topLayerId } from "./layers.js";

test("layers close top-most first and tolerate double pops", () => {
  const closed = [];
  pushLayer("a", () => closed.push("a"));
  const disposeB = pushLayer("b", () => closed.push("b"));
  assert.equal(layerCount(), 2);
  assert.equal(topLayerId(), "b");
  assert.equal(closeTopLayer(), true);
  assert.deepEqual(closed, ["b"]);
  assert.equal(layerCount(), 1);
  disposeB();
  assert.equal(layerCount(), 1);
  assert.equal(closeTopLayer(), true);
  assert.deepEqual(closed, ["b", "a"]);
  assert.equal(closeTopLayer(), false);
  popLayer("never-pushed");
  assert.equal(layerCount(), 0);
});
