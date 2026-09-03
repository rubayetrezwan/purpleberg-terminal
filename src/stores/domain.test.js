import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./createStore.js";
import { migrateSettings, sanitizeSettings, SETTINGS_DEFAULTS } from "./settings.js";
import { addToList, removeFromList, moveInList, normalizeSymbol, WATCHLIST_MAX } from "./watchlist.js";
import { migratePortfolio } from "./portfolio.js";
import { STORES, exportAll, importAll, validateExport, resetAll } from "./index.js";

test("settings migrate from the old purpleberg_theme key", () => {
  const st = memoryStorage();
  assert.equal(migrateSettings(st), null);
  st.setItem("purpleberg_theme", "light");
  assert.deepEqual(migrateSettings(st), { theme: "light" });
  assert.equal(migrateSettings(null), null);
});

test("sanitizeSettings clamps every field to an allowed value", () => {
  assert.deepEqual(sanitizeSettings({}), SETTINGS_DEFAULTS);
  assert.deepEqual(
    sanitizeSettings({ theme: "system", density: "comfortable", refreshSec: 60, defaultScreen: "DES", notifications: true }),
    { theme: "system", density: "comfortable", refreshSec: 60, defaultScreen: "DES", notifications: true }
  );
  assert.equal(sanitizeSettings({ theme: "neon" }).theme, "dark");
  assert.equal(sanitizeSettings({ refreshSec: 7 }).refreshSec, 15);
  assert.equal(sanitizeSettings({ density: "huge" }).density, "compact");
});

test("watchlist list helpers", () => {
  assert.equal(normalizeSymbol(" aapl "), "AAPL");
  assert.equal(normalizeSymbol("brk-b"), "BRK-B");
  assert.equal(normalizeSymbol("^gspc"), "^GSPC");
  assert.equal(normalizeSymbol("bad symbol!"), null);
  assert.deepEqual(addToList(["AAPL"], "msft"), ["AAPL", "MSFT"]);
  assert.deepEqual(addToList(["AAPL"], "aapl"), ["AAPL"]);
  const full = Array.from({ length: WATCHLIST_MAX }, (_, i) => `S${i}`);
  assert.equal(addToList(full, "NEW").length, WATCHLIST_MAX);
  assert.deepEqual(removeFromList(["AAPL", "MSFT"], "aapl"), ["MSFT"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "C", -1), ["A", "C", "B"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "A", -1), ["A", "B", "C"]);
  assert.deepEqual(moveInList(["A", "B", "C"], "C", 1), ["A", "B", "C"]);
});

test("portfolio migrates old holdings into dated buy transactions", () => {
  const st = memoryStorage();
  assert.equal(migratePortfolio(st), null);
  st.setItem("purpleberg_portfolio", JSON.stringify([
    { symbol: "aapl", name: "Apple", shares: 10, avgCost: 150 },
    { symbol: "MSFT", name: "Microsoft", shares: 0, avgCost: 300 },
  ]));
  const out = migratePortfolio(st, new Date(Date.UTC(2026, 8, 4)));
  assert.equal(out.transactions.length, 1);
  const tx = out.transactions[0];
  assert.equal(tx.symbol, "AAPL");
  assert.equal(tx.side, "buy");
  assert.equal(tx.shares, 10);
  assert.equal(tx.price, 150);
  assert.equal(tx.fees, 0);
  assert.equal(tx.date, "2026-09-04");
  assert.equal(tx.note, "imported");
  assert.ok(tx.id);
  st.setItem("purpleberg_portfolio", "not json");
  assert.equal(migratePortfolio(st), null);
});

test("export and import round-trip through every store", () => {
  resetAll();
  STORES.watchlist.set({ symbols: ["NVDA", "AAPL"] });
  STORES.settings.set({ ...SETTINGS_DEFAULTS, theme: "light" });
  const dump = exportAll();
  assert.equal(dump.app, "purpleberg");
  assert.equal(dump.version, 1);
  assert.deepEqual(dump.stores.watchlist, { symbols: ["NVDA", "AAPL"] });
  resetAll();
  assert.equal(STORES.settings.get().theme, "dark");
  const res = importAll(dump);
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(STORES.watchlist.get().symbols, ["NVDA", "AAPL"]);
  assert.equal(STORES.settings.get().theme, "light");
  assert.equal(validateExport({ app: "other" }), "Not a Purpleberg export file");
  assert.equal(validateExport({ app: "purpleberg", stores: { settings: 3 } }), "Invalid section: settings");
  assert.equal(importAll(null).ok, false);
  resetAll();
});
