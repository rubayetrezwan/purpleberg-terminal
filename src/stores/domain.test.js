import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./createStore.js";
import { migrateSettings, sanitizeSettings, SETTINGS_DEFAULTS, setSetting } from "./settings.js";
import { addToList, removeFromList, moveInList, normalizeSymbol, WATCHLIST_MAX, sanitizeWatchlist } from "./watchlist.js";
import { sanitizeAlerts, addAlert, rearmAlert, replaceAlertItems, alerts as alertsStore } from "./alerts.js";
import { migratePortfolio, sanitizePortfolio, localYmd } from "./portfolio.js";
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
  const out = migratePortfolio(st, new Date(2026, 8, 4, 12));
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
  assert.equal(validateExport({ app: "purpleberg", version: 1, stores: { settings: 3 } }), "Invalid section: settings");
  assert.equal(importAll(null).ok, false);
  resetAll();
});

test("importAll rejects bad inner shapes and wrong versions without touching any store", () => {
  resetAll();
  STORES.watchlist.set({ symbols: ["AAPL"] });
  let res = importAll({ app: "purpleberg", version: 1, stores: { watchlist: { symbols: "NVDA" }, alerts: { items: [] } } });
  assert.deepEqual(res, { ok: false, error: "Invalid section: watchlist" });
  assert.deepEqual(STORES.watchlist.get().symbols, ["AAPL"]);
  res = importAll({ app: "purpleberg", version: 2, stores: {} });
  assert.equal(res.ok, false);
  assert.match(res.error, /Unsupported export version/);
  const dump = exportAll();
  assert.notEqual(dump.stores.watchlist, STORES.watchlist.get());
  resetAll();
});

test("settings are sanitized on every path", () => {
  resetAll();
  STORES.settings.replace({ theme: "neon", refreshSec: 5, extra: 1 });
  assert.deepEqual(STORES.settings.get(), SETTINGS_DEFAULTS);
  setSetting("bogus", 1);
  assert.equal("bogus" in STORES.settings.get(), false);
  setSetting("density", "comfortable");
  assert.equal(STORES.settings.get().density, "comfortable");
  resetAll();
});

test("domain sanitizers repair corrupt shapes", () => {
  assert.equal(sanitizeWatchlist({ symbols: "NVDA" }).symbols.length, 8);
  assert.deepEqual(sanitizeWatchlist({ symbols: ["aapl", "AAPL", "bad symbol!", null, ""] }), { symbols: ["AAPL"] });
  assert.deepEqual(sanitizeWatchlist({ symbols: [] }), { symbols: [] });
  assert.deepEqual(sanitizeAlerts({ items: 5 }), { items: [] });
  assert.equal(sanitizeAlerts({ items: [{ id: "a", symbol: "NVDA", op: "above", price: 1 }, { id: "b" }] }).items.length, 1);
  assert.equal(sanitizePortfolio({ transactions: [{ id: "t", date: "2026-09-04", symbol: "AAPL", side: "buy", shares: 1, price: 10, fees: 0 }, { id: "u", date: "bad" }] }).transactions.length, 1);
  assert.equal(localYmd(new Date(2026, 0, 5, 21)), "2026-01-05");
});

test("re-arming an alert resets its reference so crossing detection restarts", () => {
  alertsStore.reset();
  const a = addAlert({ symbol: "NVDA", op: "above", price: 100, baseline: 90 });
  replaceAlertItems(alertsStore.get().items.map((x) => (x.id === a.id ? { ...x, lastPrice: 120, triggeredAt: 5, triggeredPrice: 120 } : x)));
  rearmAlert(a.id, 95);
  const item = alertsStore.get().items.find((x) => x.id === a.id);
  assert.equal(item.baseline, 95);
  assert.equal(item.lastPrice, 95);
  assert.equal(item.triggeredAt, null);
  assert.equal(item.triggeredPrice, null);
  alertsStore.reset();
});
