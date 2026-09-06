import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pos52, offHigh, PRESETS, presetById, matchesFilters,
  FILTER_DEFAULTS, filtersToQuery, filtersFromQuery,
} from "./screener.js";

const row = (over = {}) => ({
  symbol: "AAPL", name: "Apple Inc", price: 200, changePercent: 1, marketCap: 3e12,
  pe: 30, volume: 1e6, beta: 1.2, dividendYield: 0.5, exchange: "NMS",
  week52Low: 100, week52High: 300, ...over,
});

test("pos52: fraction of the 52-week range, null when unusable", () => {
  assert.equal(pos52(row()), 0.5);
  assert.equal(pos52(row({ price: 300 })), 1);
  assert.equal(pos52(row({ price: 100 })), 0);
  assert.equal(pos52(row({ price: 400 })), 1); // clamped
  assert.equal(pos52(row({ price: 50 })), 0); // clamped
  assert.equal(pos52(row({ week52Low: 0 })), null);
  assert.equal(pos52(row({ week52High: 100 })), null); // high not above low
  assert.equal(pos52(row({ price: 0 })), null);
});

test("offHigh: negative fraction below the high, null when unusable", () => {
  assert.equal(offHigh(row({ price: 300 })), 0);
  assert.equal(offHigh(row({ price: 150 })), -0.5);
  assert.equal(offHigh(row({ week52High: 0 })), null);
  assert.equal(offHigh(row({ price: 0 })), null);
});

test("each preset selects what it claims", () => {
  assert.equal(PRESETS.length, 6);
  const pass = (id, r) => presetById(id).test(r);
  assert.equal(pass("dividend", row({ dividendYield: 2 })), true);
  assert.equal(pass("dividend", row({ dividendYield: 1.9 })), false);
  assert.equal(pass("value", row({ pe: 15 })), true);
  assert.equal(pass("value", row({ pe: 15.1 })), false);
  assert.equal(pass("value", row({ pe: 0 })), false);
  assert.equal(pass("value", row({ pe: -5 })), false);
  assert.equal(pass("highbeta", row({ beta: 1.5 })), true);
  assert.equal(pass("highbeta", row({ beta: 1.49 })), false);
  assert.equal(pass("nearhigh", row({ price: 285 })), true);
  assert.equal(pass("nearhigh", row({ price: 284 })), false);
  assert.equal(pass("nearhigh", row({ week52High: 0 })), false);
  assert.equal(pass("nearlow", row({ price: 110 })), true);
  assert.equal(pass("nearlow", row({ price: 111 })), false);
  assert.equal(pass("megacap", row({ marketCap: 5e11 })), true);
  assert.equal(pass("megacap", row({ marketCap: 4.9e11 })), false);
  assert.equal(presetById("nope"), null);
});

test("matchesFilters: no filters passes everything", () => {
  assert.equal(matchesFilters(row(), {}), true);
  assert.equal(matchesFilters(row(), FILTER_DEFAULTS), true);
  assert.equal(matchesFilters(row()), true);
});

test("matchesFilters: search matches symbol or name, case-insensitively", () => {
  assert.equal(matchesFilters(row(), { q: "aapl" }), true);
  assert.equal(matchesFilters(row(), { q: "apple" }), true);
  assert.equal(matchesFilters(row(), { q: "PPL" }), true);
  assert.equal(matchesFilters(row(), { q: "tesla" }), false);
  assert.equal(matchesFilters(row({ name: null }), { q: "aapl" }), true);
});

test("matchesFilters: numeric bounds, and P/E bounds drop loss-makers", () => {
  assert.equal(matchesFilters(row({ pe: 30 }), { peMin: "20", peMax: "40" }), true);
  assert.equal(matchesFilters(row({ pe: 10 }), { peMin: "20" }), false);
  assert.equal(matchesFilters(row({ pe: -5 }), { peMax: "40" }), false);
  assert.equal(matchesFilters(row({ pe: 0 }), { peMax: "40" }), false);
  assert.equal(matchesFilters(row({ price: 200 }), { priceMin: "100", priceMax: "300" }), true);
  assert.equal(matchesFilters(row({ price: 50 }), { priceMin: "100" }), false);
  assert.equal(matchesFilters(row({ marketCap: 3e12 }), { capMin: "500" }), true);
  assert.equal(matchesFilters(row({ marketCap: 1e11 }), { capMin: "500" }), false);
  assert.equal(matchesFilters(row({ dividendYield: 3 }), { yieldMin: "2" }), true);
  assert.equal(matchesFilters(row({ dividendYield: 0 }), { yieldMin: "2" }), false);
  assert.equal(matchesFilters(row({ beta: 1.2 }), { betaMin: "1", betaMax: "1.5" }), true);
  assert.equal(matchesFilters(row({ beta: 0 }), { betaMin: "1" }), false);
  assert.equal(matchesFilters(row(), { posMin: "40", posMax: "60" }), true);
  assert.equal(matchesFilters(row({ price: 120 }), { posMin: "40" }), false);
  assert.equal(matchesFilters(row({ week52Low: 0 }), { posMin: "40" }), false);
  assert.equal(matchesFilters(row(), { exchange: "NMS" }), true);
  assert.equal(matchesFilters(row(), { exchange: "NYQ" }), false);
});

test("matchesFilters: every bound must hold together", () => {
  const filters = { q: "apple", peMax: "40", priceMin: "150", capMin: "100", posMax: "60" };
  assert.equal(matchesFilters(row(), filters), true);
  assert.equal(matchesFilters(row({ price: 280 }), filters), false); // position too high
});

test("filters round-trip through the query string, defaults omitted", () => {
  assert.deepEqual(filtersToQuery(FILTER_DEFAULTS), {});
  assert.deepEqual(filtersToQuery({ ...FILTER_DEFAULTS, peMax: "15", q: "bank" }), { peMax: "15", q: "bank" });
  assert.deepEqual(filtersFromQuery({}), FILTER_DEFAULTS);
  assert.deepEqual(filtersFromQuery({ peMax: "15", junk: "x" }), { ...FILTER_DEFAULTS, peMax: "15" });
  const f = { ...FILTER_DEFAULTS, betaMin: "1.5", exchange: "NMS" };
  assert.deepEqual(filtersFromQuery(filtersToQuery(f)), f);
});
