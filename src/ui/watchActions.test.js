import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleWatch } from "./watchActions.js";
import { watchlist } from "../stores/watchlist.js";
import { getToasts, clearToasts } from "./toasts.js";

test("toggleWatch adds, removes, and offers undo through a toast", () => {
  watchlist.set({ symbols: ["AAPL"] });
  clearToasts();
  assert.equal(toggleWatch("nvda"), true);
  assert.deepEqual(watchlist.get().symbols, ["AAPL", "NVDA"]);
  assert.equal(getToasts().at(-1).title, "NVDA ADDED TO WATCHLIST");
  getToasts().at(-1).actions[0].run(); // undo
  assert.deepEqual(watchlist.get().symbols, ["AAPL"]);
  assert.equal(toggleWatch("AAPL"), false);
  assert.deepEqual(watchlist.get().symbols, []);
  assert.equal(toggleWatch("not a symbol"), false);
  clearToasts();
  watchlist.reset();
});
