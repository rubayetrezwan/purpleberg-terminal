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

test("buildSuggestions: a ticker typed in full comes first, ahead of longer matches", () => {
  const list = [...pool, { symbol: "MS", name: "Morgan Stanley" }];
  const items = buildSuggestions({ value: "ms", parsed: parseCommand("ms"), poolList: list, watch: ["MSFT"] });
  assert.equal(`${items[0].kind}:${items[0].label}`, "exact:MS");
  assert.equal(items.filter((i) => i.symbol === "MS").length, 1, "listed once");
  assert.equal(items[1].label, "MSFT", "the watchlist follows");
});

test("buildSuggestions: an exact Yahoo hit leads too, for a ticker nobody tracks", () => {
  const items = buildSuggestions({
    value: "AA", parsed: parseCommand("AA"), poolList: pool, watch: ["AAPL"],
    yahoo: [{ symbol: "AA", name: "Alcoa Corporation", type: "EQUITY", exchange: "NYQ" }, { symbol: "AAPL", name: "dup" }],
  });
  assert.deepEqual(items.slice(0, 2).map((i) => `${i.kind}:${i.label}`), ["exact:AA", "watch:AAPL"]);
  assert.equal(items.filter((i) => i.symbol === "AA").length, 1, "not repeated under SEARCH");
});

test("buildSuggestions: no exact row for a partial ticker or an index", () => {
  const partial = buildSuggestions({ value: "AAP", parsed: parseCommand("AAP"), poolList: pool });
  assert.ok(!partial.some((i) => i.kind === "exact"));
  const index = buildSuggestions({ value: "^GSPC", parsed: parseCommand("^GSPC"), poolList: pool });
  assert.ok(!index.some((i) => i.kind === "exact"));
});

test("buildSuggestions: a ticker prefix outranks a name match, and names match at word starts only", () => {
  const list = [
    { symbol: "VRTX", name: "Vertex Pharmaceuticals Incorporated" },
    { symbol: "GRMN", name: "Garmin Ltd." },
    { symbol: "ARMK", name: "Aramark" },
    { symbol: "UAA", name: "Under Armour, Inc." },
    { symbol: "CSCO", name: "Cisco Systems, Inc." },
  ];
  const arm = buildSuggestions({ value: "arm", parsed: parseCommand("arm"), poolList: list });
  assert.deepEqual(arm.filter((i) => i.kind === "tracked").map((i) => i.label), ["ARMK", "UAA"]);
  const ms = buildSuggestions({ value: "ms", parsed: parseCommand("ms"), poolList: list });
  assert.ok(!ms.some((i) => i.symbol === "CSCO"), "Systems is not a word starting with MS");
});

test("buildSuggestions: Yahoo hits whose ticker starts with the text lead, with exchange names", () => {
  const items = buildSuggestions({
    value: "arm", parsed: parseCommand("arm"), poolList: [],
    yahoo: [
      { symbol: "ARR", name: "ARMOUR Residential", type: "EQUITY", exchange: "NYQ" },
      { symbol: "UAA", name: "Under Armour", type: "EQUITY", exchange: "NYQ" },
      { symbol: "ARMP", name: "Armata Pharmaceuticals", type: "EQUITY", exchange: "ASE" },
      { symbol: "ARMK", name: "Aramark", type: "EQUITY", exchange: "NMS" },
    ],
  });
  const search = items.filter((i) => i.kind === "search");
  assert.deepEqual(search.map((i) => i.label), ["ARMP", "ARMK", "ARR", "UAA"]);
  assert.equal(search[1].right, "EQUITY · NASDAQ");
});

test("parseCommand: ? is HELP", () => {
  assert.deepEqual(parseCommand("?"), { kind: "command", command: "help" });
  const items = buildSuggestions({ value: "?", parsed: parseCommand("?"), poolList: pool });
  assert.deepEqual(items.map((i) => i.label), ["HELP"]);
});

test("buildSuggestions: before Yahoo answers, a ticker-shaped word with no exact hit opens as itself", () => {
  const list = [{ symbol: "VRTX", name: "Vertex Pharmaceuticals Incorporated" }];
  const arm = buildSuggestions({ value: "arm", parsed: parseCommand("arm"), poolList: list, pending: true });
  assert.equal(`${arm[0].kind}:${arm[0].symbol}`, "exact:ARM");
  const sofi = buildSuggestions({ value: "SOFI", parsed: parseCommand("SOFI"), poolList: list, pending: true });
  assert.equal(`${sofi[0].kind}:${sofi[0].symbol}`, "exact:SOFI");
  const cls = buildSuggestions({ value: "brk.b", parsed: parseCommand("brk.b"), poolList: [], pending: true });
  assert.equal(cls[0].symbol, "BRK-B");
  // Once Yahoo has answered without it, no ticker row is invented, and a
  // name that only contains the letters mid-word is no match.
  const settled = buildSuggestions({ value: "arm", parsed: parseCommand("arm"), poolList: list });
  assert.ok(!settled.some((i) => i.kind === "exact" || i.symbol === "VRTX"));
});

test("buildSuggestions: the pending fallback leaves full tickers, names and indices alone", () => {
  const list = [...pool, { symbol: "MS", name: "Morgan Stanley" }];
  const ms = buildSuggestions({ value: "MS", parsed: parseCommand("MS"), poolList: list, watch: ["MSFT"], pending: true });
  assert.equal(`${ms[0].kind}:${ms[0].label}`, "exact:MS");
  assert.equal(ms.filter((i) => i.kind === "exact").length, 1);
  const apple = buildSuggestions({ value: "apple", parsed: parseCommand("apple"), poolList: pool, pending: true });
  assert.equal(apple[0].label, "AAPL");
  const index = buildSuggestions({ value: "^GSPC", parsed: parseCommand("^GSPC"), poolList: pool, pending: true });
  assert.ok(!index.some((i) => i.kind === "exact"));
});

test("buildSuggestions: partial command", () => {
  const items = buildSuggestions({ value: "THE", parsed: parseCommand("THE"), poolList: pool });
  assert.deepEqual(items.map((i) => i.label), ["THEME"]);
});
