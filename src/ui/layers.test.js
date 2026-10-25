import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { pushLayer, popLayer, closeTopLayer, layerCount, topLayerId, hasModalLayer } from "./layers.js";

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

test("pushing the same id again replaces its handler instead of duplicating it", () => {
  const calls = [];
  pushLayer("dup", () => calls.push("first"));
  pushLayer("dup", () => calls.push("second"));
  assert.equal(layerCount(), 1);
  assert.equal(closeTopLayer(), true);
  assert.deepEqual(calls, ["second"]);
  assert.equal(layerCount(), 0);
});

test("a throwing close handler keeps its layer on the stack", () => {
  const restore = mock.method(console, "error", () => {});
  pushLayer("bad", () => { throw new Error("boom"); });
  assert.equal(closeTopLayer(), true);
  assert.equal(layerCount(), 1);
  popLayer("bad");
  restore.mock.restore();
});

test("only modal layers count as modal; popovers leave the shortcuts alone", () => {
  pushLayer("bell", () => {}, { modal: false });
  assert.equal(hasModalLayer(), false);
  pushLayer("drawer", () => {});
  assert.equal(hasModalLayer(), true);
  popLayer("drawer");
  popLayer("bell");
  assert.equal(layerCount(), 0);
});

test("opening a popover closes the other, but not a modal underneath", () => {
  const closed = [];
  pushLayer("drawer", () => closed.push("drawer"));
  pushLayer("bell", () => { closed.push("bell"); }, { modal: false });
  pushLayer("clock", () => closed.push("clock"), { modal: false });
  assert.deepEqual(closed, ["bell"]);
  assert.equal(layerCount(), 2);
  assert.equal(topLayerId(), "clock");
  // Escape still goes top-most first.
  closeTopLayer();
  closeTopLayer();
  assert.deepEqual(closed, ["bell", "clock", "drawer"]);
  assert.equal(layerCount(), 0);
});

test("a popover whose close handler throws stays on the stack", () => {
  const restore = mock.method(console, "error", () => {});
  pushLayer("stuck", () => { throw new Error("boom"); }, { modal: false });
  pushLayer("next", () => {}, { modal: false });
  assert.equal(layerCount(), 2);
  popLayer("next");
  popLayer("stuck");
  restore.mock.restore();
});
