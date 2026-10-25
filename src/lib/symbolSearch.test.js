import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRows, pickFromFilter } from "./symbolSearch.js";
import { UNIVERSE } from "../data/universe.js";

const rows = [
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "AMS", name: "Example AMS" },
  { symbol: "WMB", name: "The Williams Companies" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "BRK-B", name: "Berkshire Hathaway Inc." },
];

test("an exact ticker leads, then prefixes, then contains, then names", () => {
  assert.deepEqual(filterRows(rows, "ms").map((r) => r.symbol), ["MS", "MSFT", "AMS", "WMB"]);
});

test("ties keep the list order", () => {
  const list = [{ symbol: "AAA1", name: "" }, { symbol: "AAA2", name: "" }];
  assert.deepEqual(filterRows(list, "AAA").map((r) => r.symbol), ["AAA1", "AAA2"]);
});

test("a blank filter returns the list untouched", () => {
  assert.equal(filterRows(rows, "  "), rows);
});

test("a dotted class share finds the dashed Yahoo symbol", () => {
  assert.deepEqual(filterRows(rows, "brk.b").map((r) => r.symbol), ["BRK-B"]);
});

test("company names match", () => {
  assert.deepEqual(filterRows(rows, "morgan").map((r) => r.symbol), ["MS"]);
});

test("Enter opens the best match, or the typed ticker when nothing matches", () => {
  assert.equal(pickFromFilter(filterRows(rows, "ms"), "ms"), "MS");
  assert.equal(pickFromFilter(filterRows(rows, "aa"), "aa"), "AA");
  assert.equal(pickFromFilter(filterRows(rows, "rds.a"), "rds.a"), "RDS-A");
  assert.equal(pickFromFilter([], "not a ticker"), null);
  assert.equal(pickFromFilter(rows, ""), null);
});

test("the universe holds the S&P 500 and the big names outside it", () => {
  const syms = new Set(UNIVERSE.map((u) => u.symbol));
  assert.ok(UNIVERSE.length >= 600, `only ${UNIVERSE.length} rows`);
  assert.ok(UNIVERSE.filter((u) => u.spx).length >= 495);
  for (const s of ["AAPL", "JPM", "BRK-B", "TSM", "ASML", "XOM"]) assert.ok(syms.has(s), s);
  assert.equal(syms.size, UNIVERSE.length, "duplicate symbols");
  assert.ok(UNIVERSE.every((u) => u.name && u.sector), "every row has a name and a sector");
});
