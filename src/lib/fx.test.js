import { test } from "node:test";
import assert from "node:assert/strict";
import { pipSize, rateDecimals, amountDecimals, parseAmount, isIndicative, lastClose, fxChange, closeBefore, fxSessionDate } from "./fx.js";

test("pip size and rate decimals follow the quote's magnitude", () => {
  assert.equal(pipSize(1.12), 0.0001);
  assert.equal(pipSize(156.8), 0.01);
  assert.equal(rateDecimals(1.12), 4);
  assert.equal(rateDecimals(123.4), 2);
});

test("amounts use the currency's minor unit", () => {
  assert.equal(amountDecimals("JPY"), 0);
  assert.equal(amountDecimals("USD"), 2);
  assert.equal(amountDecimals("BDT"), 2);
  assert.equal(amountDecimals(undefined), 2);
});

test("parseAmount reads typed amounts and refuses the rest", () => {
  assert.equal(parseAmount("1,000"), 1000);
  assert.equal(parseAmount(" 0.5 "), 0.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount(null), null);
});

const jpySunday = {
  price: 156.814, change: 0.039, changePercent: 0.0249, open: 156.774, high: 157.16, low: 156.072, marketState: "CLOSED",
};
const jpyHistory = [
  { date: "2026-10-21", close: 158.268 },
  { date: "2026-10-22", close: 158.132 },
  { date: "2026-10-23", close: 156.81399536 },
];

test("a quote is indicative when the market is closed or its range is empty", () => {
  assert.equal(isIndicative(jpySunday), true);
  assert.equal(isIndicative({ ...jpySunday, marketState: "REGULAR" }), false);
  assert.equal(isIndicative({ price: 123.41, high: 123.41, low: 123.41, marketState: "REGULAR" }), true, "empty range");
  assert.equal(isIndicative({ price: 0, high: 0, low: 0 }), false, "no quote at all");
});

test("a closed quote that is the last bar is measured against the bar before", () => {
  const out = fxChange(jpySunday, jpyHistory);
  assert.equal(out.indicative, true);
  assert.equal(out.basis.date, "2026-10-22");
  assert.equal(out.changePercent.toFixed(2), "-0.83", "Friday's move, not Yahoo's +0.02%");
});

test("a quote away from the last close is measured against that close", () => {
  const bdt = { price: 123.41, change: 0, changePercent: 0, high: 123.9, low: 123.41, open: 123.9, marketState: "CLOSED" };
  const rows = [{ date: "2026-10-22", close: 119.916 }, { date: "2026-10-23", close: 119.942 }];
  const out = fxChange(bdt, rows);
  assert.equal(out.basis.close, 119.942);
  assert.equal(out.changePercent.toFixed(2), "2.89");
});

test("an indicative quote has no change until its history arrives", () => {
  const out = fxChange(jpySunday, []);
  assert.deepEqual(out, { indicative: true, change: null, changePercent: null, basis: null });
  assert.equal(lastClose(null, 1, 0.0001), null);
});

test("a live quote keeps the feed's change while no history has arrived", () => {
  const live = { ...jpySunday, marketState: "REGULAR" };
  assert.deepEqual(fxChange(live, []), { indicative: false, change: 0.039, changePercent: 0.0249, basis: null });
});

test("a live change is measured from the previous session's daily close", () => {
  // Monday 05:26 in London. Yahoo said USD/BDT -1.48% (from a wrong 123.41).
  const now = new Date("2026-10-26T05:26:00Z");
  assert.equal(fxSessionDate(now), "2026-10-26");
  const rows = [{ date: "2026-10-22", close: 119.92 }, { date: "2026-10-23", close: 119.94 }, { date: "2026-10-26", close: 121.58 }];
  const q = { price: 121.58, change: -1.83, changePercent: -1.48, high: 121.6, low: 121.5, marketState: "REGULAR" };
  const m = fxChange(q, rows, now);
  assert.equal(m.indicative, false);
  assert.equal(m.basis.date, "2026-10-23");
  assert.ok(Math.abs(m.changePercent - 1.367) < 0.01);
});

test("today's bar is never the basis, with or without one in the history", () => {
  const rows = [{ date: "2026-10-22", close: 1.3390 }, { date: "2026-10-23", close: 1.3404 }];
  assert.deepEqual(closeBefore(rows, "2026-10-26"), { close: 1.3404, date: "2026-10-23" });
  assert.deepEqual(closeBefore([...rows, { date: "2026-10-26", close: 1.3376 }], "2026-10-26"), { close: 1.3404, date: "2026-10-23" });
  assert.equal(closeBefore([], "2026-10-26"), null);
});

test("without history a live quote keeps Yahoo's change", () => {
  const q = { price: 1.1223, change: 0.0019, changePercent: 0.17, high: 1.123, low: 1.1206, marketState: "REGULAR" };
  assert.equal(fxChange(q, null).changePercent, 0.17);
});
