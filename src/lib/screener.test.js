import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pos52, offHigh, PRESETS, presetById, matchesFilters,
  FILTER_DEFAULTS, filtersToQuery, filtersFromQuery, positiveOrNull,
  nonZeroOrNull, activeFilterCount, filterProblems,
} from "./screener.js";
import { sortRows } from "../ui/tableUtils.js";

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

test("matchesFilters: sector and index membership", () => {
  const bank = row({ sector: "Financial Services", spx: true, ndx: false });
  const adr = row({ sector: "Technology", spx: false, ndx: false });
  assert.equal(matchesFilters(bank, { sector: "Financial Services" }), true);
  assert.equal(matchesFilters(adr, { sector: "Financial Services" }), false);
  assert.equal(matchesFilters(bank, { index: "spx" }), true);
  assert.equal(matchesFilters(bank, { index: "ndx" }), false);
  assert.equal(matchesFilters(adr, { index: "other" }), true);
  assert.equal(matchesFilters(bank, { index: "other" }), false);
  assert.equal(matchesFilters(adr, { index: "bogus" }), true);
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

test("matchesFilters: a missing price fails price bounds", () => {
  assert.equal(matchesFilters(row({ price: 0 }), { priceMax: "20" }), false);
  assert.equal(matchesFilters(row({ price: null }), { priceMax: "20" }), false);
  assert.equal(matchesFilters(row({ price: 0 }), { priceMin: "0" }), false);
  assert.equal(matchesFilters(row({ price: 15 }), { priceMax: "20" }), true);
});

test("matchesFilters: a bound that is not a number is ignored, not fatal", () => {
  assert.equal(matchesFilters(row(), { peMin: "abc" }), true);
  assert.equal(matchesFilters(row(), { priceMax: "x", betaMin: "NaN", capMin: "Infinity" }), true);
  assert.equal(matchesFilters(row({ pe: 50 }), { peMin: "abc", peMax: "40" }), false); // the valid bound still applies
});

test("positiveOrNull sorts placeholder zeros last in both directions", () => {
  assert.equal(positiveOrNull(12), 12);
  assert.equal(positiveOrNull("1.5"), 1.5);
  assert.equal(positiveOrNull(0), null);
  assert.equal(positiveOrNull(-3), null);
  assert.equal(positiveOrNull(null), null);
  assert.equal(positiveOrNull(undefined), null);
  const rows = [row({ symbol: "A", pe: 0 }), row({ symbol: "B", pe: 20 }), row({ symbol: "C", pe: 10 }), row({ symbol: "D", pe: -4 })];
  const columns = [{ key: "pe", sortValue: (r) => positiveOrNull(r.pe) }];
  const order = (dir) => sortRows(rows, columns, { key: "pe", dir }).map((r) => r.symbol);
  assert.deepEqual(order("asc"), ["C", "B", "A", "D"]);
  assert.deepEqual(order("desc"), ["B", "C", "A", "D"]);
});

test("a negative beta is a real beta: it shows, sorts and filters", () => {
  assert.equal(nonZeroOrNull(-0.661), -0.661);
  assert.equal(nonZeroOrNull("-0.196"), -0.196);
  assert.equal(nonZeroOrNull(1.2), 1.2);
  assert.equal(nonZeroOrNull(0), null);
  assert.equal(nonZeroOrNull(null), null);
  assert.equal(nonZeroOrNull(""), null);
  assert.equal(nonZeroOrNull("abc"), null);
  const bp = row({ symbol: "BP", beta: -0.196 });
  assert.equal(matchesFilters(bp, { betaMax: "0" }), true);
  assert.equal(matchesFilters(bp, { betaMin: "-1", betaMax: "1" }), true);
  assert.equal(matchesFilters(bp, { betaMin: "0" }), false);
  assert.equal(matchesFilters(row({ beta: 0 }), { betaMax: "1" }), false); // placeholder 0 is still missing
  assert.equal(presetById("highbeta").test(bp), false);
  const rows = [row({ symbol: "A", beta: 0 }), bp, row({ symbol: "C", beta: 1.4 })];
  const columns = [{ key: "beta", sortValue: (r) => nonZeroOrNull(r.beta) }];
  assert.deepEqual(sortRows(rows, columns, { key: "beta", dir: "asc" }).map((r) => r.symbol), ["BP", "C", "A"]);
});

test("matchesFilters: exchange groups Yahoo codes by name", () => {
  assert.equal(matchesFilters(row({ exchange: "NMS" }), { exchange: "NASDAQ" }), true);
  assert.equal(matchesFilters(row({ exchange: "NGM" }), { exchange: "NASDAQ" }), true);
  assert.equal(matchesFilters(row({ exchange: "NCM" }), { exchange: "NMS" }), true); // an old link's raw code
  assert.equal(matchesFilters(row({ exchange: "NYQ" }), { exchange: "NASDAQ" }), false);
  assert.equal(matchesFilters(row({ exchange: "NYQ" }), { exchange: "NYSE" }), true);
});

test("activeFilterCount counts filled fields only", () => {
  assert.equal(activeFilterCount(FILTER_DEFAULTS), 0);
  assert.equal(activeFilterCount({}), 0);
  assert.equal(activeFilterCount({ ...FILTER_DEFAULTS, q: "  " }), 0);
  assert.equal(activeFilterCount({ ...FILTER_DEFAULTS, peMin: "5", peMax: "20", sector: "Energy" }), 3);
  assert.equal(activeFilterCount({ junk: "x" }), 0);
});

test("filterProblems names bounds that can never match", () => {
  assert.deepEqual(filterProblems(FILTER_DEFAULTS), []);
  assert.deepEqual(filterProblems({ peMin: "10", peMax: "50" }), []);
  assert.deepEqual(filterProblems({ peMin: "50", peMax: "10" }), [{ keys: ["peMin", "peMax"], text: "P/E MIN > MAX" }]);
  assert.deepEqual(filterProblems({ priceMin: "-5" }).map((p) => p.text), ["PRICE MIN < 0"]);
  assert.deepEqual(filterProblems({ priceMax: "-1" }).map((p) => p.text), ["PRICE MAX < 0"]);
  assert.deepEqual(filterProblems({ posMin: "120" }).map((p) => p.text), ["52W POS MIN > 100"]);
  assert.deepEqual(filterProblems({ betaMin: "-1", betaMax: "-0.1" }), []); // beta may be negative
  assert.deepEqual(filterProblems({ betaMin: "2", betaMax: "1" }).map((p) => p.text), ["BETA MIN > MAX"]);
  assert.deepEqual(filterProblems({ peMin: "abc", peMax: "10" }), []); // junk is ignored, as in matching
  assert.equal(filterProblems({ peMin: "50", peMax: "10", capMin: "-1" }).length, 2);
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
