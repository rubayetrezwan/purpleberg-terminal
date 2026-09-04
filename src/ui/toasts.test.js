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
  assert.equal(getToasts(), before);
  dismissToast(id);
  assert.equal(getToasts().length, 0);
  mock.timers.reset();
});
