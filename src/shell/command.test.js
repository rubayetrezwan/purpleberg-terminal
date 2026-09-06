import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "./commandParser.js";
import { buildSuggestions } from "./suggestions.js";

test("parseCommand grammar", () => {
  assert.deepEqual(parseCommand(""), { kind: "empty" });
  assert.deepEqual(parseCommand("wei"), { kind: "navigate", name: "dashboard", params: {}, query: {} });
  assert.deepEqual(parseCommand("DES AAPL"), { kind: "navigate", name: "equities", params: { symbol: "AAPL" }, query: {} });
  assert.deepEqual(parseCommand("aapl des"), { kind: "navigate", name: "equities", params: { symbol: "AAPL" }, query: {} });
  assert.deepEqual(parseCommand("WFX eur/usd"), { kind: "navigate", name: "fx", params: { pair: "EURUSD" }, query: {} });
  assert.deepEqual(parseCommand("CRYP Bitcoin"), { kind: "navigate", name: "crypto", params: { id: "bitcoin" }, query: {} });
  assert.deepEqual(parseCommand("eco"), { kind: "navigate", name: "rates", params: {}, query: { tab: "calendar" } });
  assert.deepEqual(parseCommand("EQS AAPL"), { kind: "navigate", name: "screener", params: {}, query: {} });
  assert.deepEqual(parseCommand("theme"), { kind: "command", command: "theme" });
  assert.deepEqual(parseCommand("nvda"), { kind: "search", query: "NVDA" });
  assert.deepEqual(parseCommand("apple inc"), { kind: "search", query: "APPLE INC" });
});

const pool = [
  { symbol: "AAPL", name: "Apple Inc", price: 1, changePercent: 0, exchange: "NMS" },
  { symbol: "AAL", name: "American Airlines", price: 1 },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "MSFT", name: "Microsoft" },
];

test("buildSuggestions: empty input lists functions then commands", () => {
  const items = buildSuggestions({ value: "", parsed: parseCommand(""), poolList: pool, watch: [] });
  assert.equal(items.length, 15);
  assert.equal(items[0].label, "WEI");
  assert.equal(items[14].label, "HELP");
});

test("buildSuggestions: a mnemonic yields exactly that function with its params", () => {
  const items = buildSuggestions({ value: "DES AAPL", parsed: parseCommand("DES AAPL"), poolList: pool });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "function");
  assert.deepEqual(items[0].params, { symbol: "AAPL" });
});

test("buildSuggestions: symbol search orders watchlist, tracked, then Yahoo without duplicates", () => {
  const items = buildSuggestions({
    value: "AA", parsed: parseCommand("AA"), poolList: pool, watch: ["AAPL"],
    yahoo: [{ symbol: "AAPL", name: "dup" }, { symbol: "AAOI", name: "Applied Opto", type: "EQUITY", exchange: "NMS" }],
  });
  assert.deepEqual(items.map((i) => `${i.kind}:${i.label}`), ["watch:AAPL", "tracked:AAL", "search:AAOI"]);
});

test("buildSuggestions: partial command", () => {
  const items = buildSuggestions({ value: "THE", parsed: parseCommand("THE"), poolList: pool });
  assert.deepEqual(items.map((i) => i.label), ["THEME"]);
});
