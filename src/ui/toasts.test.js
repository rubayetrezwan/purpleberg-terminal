import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { toast, dismissToast, getToasts, clearToasts } from "./toasts.js";

test("toast stacks to five, auto-dismisses, sticky ones stay", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  clearToasts();
  for (let i = 0; i < 6; i += 1) toast({ title: "t" + i, ttlMs: 1000 });
  assert.equal(getToasts().length, 5);
  assert.equal(getToasts()[0].title, "t1");
  mock.timers.tick(1001);
  assert.equal(getToasts().length, 0);
  const id = toast({ title: "sticky", sticky: true });
  mock.timers.tick(10_000);
  assert.equal(getToasts().length, 1);
  const before = getToasts();
  dismissToast("no-such-id");
  assert.equal(getToasts(), before);
  dismissToast(id);
  assert.equal(getToasts().length, 0);
  mock.timers.reset();
});

test("sticky toasts survive truncation; the oldest non-sticky goes first", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  clearToasts();
  const alertId = toast({ title: "alert", sticky: true });
  for (let i = 0; i < 6; i += 1) toast({ title: "info" + i, ttlMs: 1000 });
  const titles = getToasts().map((t) => t.title);
  assert.equal(getToasts().length, 5);
  assert.equal(titles[0], "alert");
  assert.deepEqual(titles.slice(1), ["info2", "info3", "info4", "info5"]);
  dismissToast(alertId);
  assert.equal(toast({ title: "no actions", actions: null }).length > 0, true);
  assert.deepEqual(getToasts().at(-1).actions, []);
  clearToasts();
  mock.timers.reset();
});
