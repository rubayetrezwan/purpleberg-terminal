import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmt, fmtNum, fmtK, fmtPct, fmtSigned, fmtAgo, fmtCountdown,
  fmtDateTable, fmtAxisDate, fmtTooltipDate, fmtClock, ts,
} from "./format.js";

test("fmt: fixed decimals, em dash for missing", () => {
  assert.equal(fmt(2.5, 1), "2.5");
  assert.equal(fmt(3), "3.00");
  assert.equal(fmt(null), "—");
  assert.equal(fmt(NaN), "—");
  assert.equal(fmt("abc"), "—");
});

test("fmtNum: thousands separators", () => {
  assert.equal(fmtNum(1234567.891, 2), "1,234,567.89");
  assert.equal(fmtNum(42, 0), "42");
  assert.equal(fmtNum(null), "—");
});

test("fmtK: magnitude suffixes including negatives", () => {
  assert.equal(fmtK(1.5e12), "1.50T");
  assert.equal(fmtK(2.5e9), "2.5B");
  assert.equal(fmtK(-3.2e6), "-3.2M");
  assert.equal(fmtK(12_500), "12.5K");
  assert.equal(fmtK(950), "950");
  assert.equal(fmtK(0), "0");
  assert.equal(fmtK(undefined), "—");
  assert.equal(fmtK(999_999), "1.0M");
  assert.equal(fmtK(999_999_999), "1.0B");
  assert.equal(fmtK(999_999_999_999), "1.00T");
  assert.equal(fmtK(-999_999), "-1.0M");
});

test("fmtPct and fmtSigned carry an explicit sign", () => {
  assert.equal(fmtPct(1.234), "+1.23%");
  assert.equal(fmtPct(-0.5), "-0.50%");
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtSigned(2.345), "+2.35");
  assert.equal(fmtSigned(-1), "-1.00");
  assert.equal(fmtSigned(0), "0.00");
});

test("fmtAgo: coarse relative age", () => {
  assert.equal(fmtAgo(9_000), "9s");
  assert.equal(fmtAgo(125_000), "2m");
  assert.equal(fmtAgo(3_700_000), "1h");
  assert.equal(fmtAgo(2 * 86_400_000), "2d");
  assert.equal(fmtAgo(-1), "—");
  assert.equal(fmtAgo(null), "—");
});

test("fmtCountdown: h:mm:ss, never negative", () => {
  assert.equal(fmtCountdown(2 * 3_600_000 + 41 * 60_000 + 7_000), "2:41:07");
  assert.equal(fmtCountdown(59_000), "0:00:59");
  assert.equal(fmtCountdown(-5), "0:00:00");
  assert.equal(fmtCountdown(null), "—");
});

test("date formatters", () => {
  assert.equal(fmtDateTable("2026-09-04"), "04 SEP 26");
  assert.equal(fmtDateTable(""), "—");
  assert.equal(fmtDateTable("bad"), "bad");
  assert.equal(fmtAxisDate("2026-03-14"), "Mar 14");
  assert.equal(fmtAxisDate("2026-03-14", true), "Mar '26");
  assert.equal(fmtTooltipDate("2026-03-14"), "Mar 14, 2026");
});

test("fmtClock: 24-hour clock in a given zone", () => {
  const d = new Date(Date.UTC(2026, 8, 4, 14, 18, 53));
  assert.equal(fmtClock(d, "UTC"), "14:18:53");
  assert.equal(fmtClock(d, "Asia/Tokyo"), "23:18:53");
  assert.equal(fmtClock(d, "Not/AZone"), "—");
  assert.equal(fmtClock(d, "Not/AZone"), "—");
  assert.equal(fmtClock(new Date(NaN), "UTC"), "—");
  assert.equal(fmtClock("2026-09-04", "UTC"), "—");
  assert.equal(fmtClock(d, ""), fmtClock(d));
  assert.match(ts(), /^\d{2}:\d{2}:\d{2}$/);
});
