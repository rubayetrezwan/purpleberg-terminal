import { test } from "node:test";
import assert from "node:assert/strict";
import { TICKER_RE, normalizeSymbol } from "./ticker.js";

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
