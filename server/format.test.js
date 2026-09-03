import { test } from "node:test";
import assert from "node:assert/strict";
import { raw, normalizeFinnhubIpo, crossRate } from "./format.js";

test("raw unwraps Yahoo's { raw, fmt } shape to the numeric value", () => {
  assert.equal(raw({ raw: 36.2, fmt: "36.20" }), 36.2);
  assert.equal(raw({ raw: 0, fmt: "0.00" }), 0); // a genuine zero survives
  assert.equal(raw({ raw: -1.5 }), -1.5);
});

test("raw passes plain numbers through unchanged", () => {
  assert.equal(raw(42), 42);
  assert.equal(raw(0), 0);
  assert.equal(raw(-7.25), -7.25);
});

test("raw returns 0 for null / undefined", () => {
  assert.equal(raw(null), 0);
  assert.equal(raw(undefined), 0);
});

test("raw returns 0 for an empty {} (value-less Yahoo field) instead of leaking the object", () => {
  // Regression: the old helper returned {} here, which rendered as
  // "[object Object]"/NaN downstream (e.g. price-to-sales on the Ratios tab).
  assert.equal(raw({}), 0);
});

test("raw returns 0 when .raw is present but not a number", () => {
  assert.equal(raw({ raw: null }), 0);
  assert.equal(raw({ raw: undefined }), 0);
  assert.equal(raw({ fmt: "N/A" }), 0);
});

test("normalizeFinnhubIpo flattens and sorts newest-first", () => {
  const payload = {
    ipoCalendar: [
      { date: "2026-06-01", name: "Alpha Co", symbol: "ALPH", exchange: "NASDAQ", price: "18.00-20.00", numberOfShares: 1000000, totalSharesValue: 20000000, status: "expected" },
      { date: "2026-06-15", name: "Beta Co", symbol: "BETA", exchange: "NYSE", price: "30.00", numberOfShares: 500000, totalSharesValue: 15000000, status: "priced" },
    ],
  };
  const out = normalizeFinnhubIpo(payload);
  assert.equal(out.length, 2);
  assert.equal(out[0].symbol, "BETA"); // newest first
  assert.equal(out[0].dealValue, 15000000);
  assert.equal(out[1].shares, 1000000);
});

test("normalizeFinnhubIpo tolerates missing / malformed input", () => {
  assert.deepEqual(normalizeFinnhubIpo(null), []);
  assert.deepEqual(normalizeFinnhubIpo({}), []);
  assert.deepEqual(normalizeFinnhubIpo({ ipoCalendar: "nope" }), []);
});

test("crossRate computes pairs from a USD-based rate table", () => {
  const rates = { EUR: 0.92, GBP: 0.79, JPY: 156, BDT: 119, AUD: 1.52 };
  assert.ok(Math.abs(crossRate("EURUSD=X", rates) - 1 / 0.92) < 1e-9); // EUR/USD
  assert.equal(crossRate("USDJPY=X", rates), 156); // USD/JPY
  assert.ok(Math.abs(crossRate("EURGBP=X", rates) - 0.79 / 0.92) < 1e-9); // cross
  assert.equal(crossRate("USDBDT=X", rates), 119); // USD/BDT
  assert.ok(Math.abs(crossRate("AUDBDT=X", rates) - 119 / 1.52) < 1e-9); // synthetic cross
});

test("crossRate returns null when a leg is missing or input is bad", () => {
  const rates = { EUR: 0.92 };
  assert.equal(crossRate("EURBDT=X", rates), null); // BDT missing
  assert.equal(crossRate("EUR=X", rates), null); // malformed
  assert.equal(crossRate(null, rates), null);
  assert.equal(crossRate("EURUSD=X", null), null);
});
