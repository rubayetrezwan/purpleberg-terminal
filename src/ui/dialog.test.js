import { test } from "node:test";
import assert from "node:assert/strict";
import { confirm, settleDialog, getDialog, subscribeDialog } from "./dialog.js";

test("confirm resolves with the settled value and clears state before resolving", async () => {
  const seen = [];
  const off = subscribeDialog(() => seen.push(getDialog() ? "open" : "closed"));
  const p = confirm({ title: "T", body: "B", confirmLabel: "GO" });
  assert.equal(getDialog().title, "T");
  settleDialog(true);
  assert.equal(getDialog(), null);
  assert.equal(await p, true);
  assert.deepEqual(seen, ["open", "closed"]);
  off();
});

test("a second confirm supersedes the first, which resolves false", async () => {
  const first = confirm({ title: "one" });
  const second = confirm({ title: "two" });
  assert.equal(getDialog().title, "two");
  assert.equal(await first, false);
  settleDialog(false);
  assert.equal(await second, false);
  assert.equal(getDialog(), null);
});
