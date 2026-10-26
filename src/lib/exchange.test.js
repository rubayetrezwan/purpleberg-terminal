import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangeLabel } from "./exchange.js";

test("Yahoo exchange codes read as exchange names", () => {
  assert.equal(exchangeLabel("NMS"), "NASDAQ");
  assert.equal(exchangeLabel("NYQ"), "NYSE");
  assert.equal(exchangeLabel("BTS"), "CBOE");
  assert.equal(exchangeLabel("XYZ"), "XYZ", "unknown codes pass through");
  assert.equal(exchangeLabel(""), "");
});
