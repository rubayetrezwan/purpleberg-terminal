import { test } from "node:test";
import assert from "node:assert/strict";
import { TICKER_RE, normalizeSymbol, toYahooSymbol } from "./ticker.js";

test("normalizeSymbol matches the proxy's ticker rule", () => {
  assert.equal(normalizeSymbol(" aapl "), "AAPL");
  assert.equal(normalizeSymbol("brk-b"), "BRK-B");
  assert.equal(normalizeSymbol("^gspc"), "^GSPC");
  assert.equal(normalizeSymbol("CL=F"), "CL=F");
  assert.equal(normalizeSymbol("bad symbol!"), null);
  assert.equal(normalizeSymbol(null), null);
  assert.equal(normalizeSymbol(""), null);
  assert.equal(TICKER_RE.test("A".repeat(16)), false);
});

test("toYahooSymbol writes share classes the way Yahoo lists them", () => {
  assert.equal(toYahooSymbol("BRK.B"), "BRK-B");
  assert.equal(toYahooSymbol(" brk.b "), "BRK-B");
  assert.equal(toYahooSymbol("BRK/A"), "BRK-A");
  assert.equal(toYahooSymbol("bf.b"), "BF-B");
  assert.equal(toYahooSymbol("BRK-B"), "BRK-B");
});

test("toYahooSymbol leaves exchange suffixes and plain tickers alone", () => {
  assert.equal(toYahooSymbol("000001.SS"), "000001.SS");
  assert.equal(toYahooSymbol("RY.TO"), "RY.TO");
  assert.equal(toYahooSymbol("aapl"), "AAPL");
  assert.equal(toYahooSymbol("^GSPC"), "^GSPC");
  assert.equal(toYahooSymbol("bad symbol!"), null);
  assert.equal(toYahooSymbol(""), null);
});
