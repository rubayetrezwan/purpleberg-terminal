import { test } from "node:test";
import assert from "node:assert/strict";
import { contractMonth, hasRollLull } from "./futures.js";

const oct2026 = new Date("2026-10-25T12:00:00Z");

test("contractMonth reads Yahoo's front-month names", () => {
  assert.equal(contractMonth("Crude Oil Dec 26", oct2026), "DEC '26");
  assert.equal(contractMonth("Chicago SRW Wheat Futures,May-2026", oct2026), "MAY '26");
  assert.equal(contractMonth("Gold", oct2026), "");
  assert.equal(contractMonth("", oct2026), "");
  assert.equal(contractMonth(null, oct2026), "");
});

test("contractMonth completes a year Yahoo cut short", () => {
  assert.equal(contractMonth("Chicago SRW Wheat Futures,Dec-2", oct2026), "DEC '26");
  // A month already gone this year is next year's contract.
  assert.equal(contractMonth("Chicago SRW Wheat Futures,Mar-2", oct2026), "MAR '27");
  // A contract in its last weeks after the month turned is still this year's.
  assert.equal(contractMonth("Chicago SRW Wheat Futures,Sep-2", oct2026), "SEP '26");
  assert.equal(contractMonth("Corn Futures,Dec-20", oct2026), "DEC '20", "two digits are a year as given");
});

test("hasRollLull finds runs of near-zero volume", () => {
  const base = Array.from({ length: 40 }, () => ({ volume: 60000 }));
  assert.equal(hasRollLull(base), false);
  const lull = base.map((r, i) => (i >= 10 && i < 15 ? { volume: i * 10 } : r));
  assert.equal(hasRollLull(lull), true);
  const blip = base.map((r, i) => (i === 10 ? { volume: 0 } : r));
  assert.equal(hasRollLull(blip), false, "one quiet day is not a roll");
  assert.equal(hasRollLull([]), false);
  assert.equal(hasRollLull(null), false);
});
