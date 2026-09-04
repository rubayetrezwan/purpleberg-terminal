import { test } from "node:test";
import assert from "node:assert/strict";
import { nyseSession, etOffsetMinutes, etInstant, nextTradingDay, isTradingDay, stateFromMarketState } from "./session.js";

const at = (iso) => new Date(iso);
const iso = (d) => d.toISOString();

test("Eastern offset flips with DST", () => {
  assert.equal(etOffsetMinutes(at("2026-07-01T12:00:00Z")), -240);
  assert.equal(etOffsetMinutes(at("2026-01-15T12:00:00Z")), -300);
});

test("etInstant builds the right UTC instant on both sides of DST", () => {
  assert.equal(iso(etInstant("2026-09-04", 9 * 60 + 30)), "2026-09-04T13:30:00.000Z");
  assert.equal(iso(etInstant("2026-11-27", 13 * 60)), "2026-11-27T18:00:00.000Z");
  assert.equal(iso(etInstant("2026-03-09", 9 * 60 + 30)), "2026-03-09T13:30:00.000Z");
  assert.equal(iso(etInstant("2026-11-02", 9 * 60 + 30)), "2026-11-02T14:30:00.000Z");
});

test("trading days skip weekends and holidays", () => {
  assert.equal(isTradingDay("2026-09-04"), true);
  assert.equal(isTradingDay("2026-09-05"), false);
  assert.equal(isTradingDay("2026-09-07"), false); // Labor Day
  assert.equal(nextTradingDay("2026-09-04"), "2026-09-08");
  assert.equal(nextTradingDay("2026-07-02"), "2026-07-06"); // Jul 3 observed holiday, then weekend
});

test("regular session states and countdown targets", () => {
  let s = nyseSession(at("2026-09-04T14:00:00Z")); // Fri 10:00 EDT
  assert.equal(s.state, "open");
  assert.equal(s.countdownLabel, "closes");
  assert.equal(iso(s.countdownTo), "2026-09-04T20:00:00.000Z");

  s = nyseSession(at("2026-09-04T12:00:00Z")); // 08:00 EDT
  assert.equal(s.state, "pre");
  assert.equal(iso(s.countdownTo), "2026-09-04T13:30:00.000Z");

  s = nyseSession(at("2026-09-04T21:00:00Z")); // 17:00 EDT
  assert.equal(s.state, "post");
  assert.equal(s.countdownLabel, "opens");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");

  s = nyseSession(at("2026-09-05T01:00:00Z")); // Fri 21:00 EDT
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");

  s = nyseSession(at("2026-09-04T06:00:00Z")); // Fri 02:00 EDT, before pre-market
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-04T13:30:00.000Z");
});

test("weekends and holidays are closed with the next open as target", () => {
  let s = nyseSession(at("2026-09-05T15:00:00Z")); // Saturday
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-09-08T13:30:00.000Z");
  s = nyseSession(at("2026-07-03T15:00:00Z")); // Independence Day observed
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-07-06T13:30:00.000Z");
});

test("early close days close at 13:00 ET", () => {
  let s = nyseSession(at("2026-11-27T17:30:00Z")); // 12:30 EST
  assert.equal(s.state, "open");
  assert.equal(s.early, true);
  assert.equal(iso(s.countdownTo), "2026-11-27T18:00:00.000Z");
  s = nyseSession(at("2026-11-27T18:30:00Z")); // 13:30 EST
  assert.equal(s.state, "post");
});

test("DST boundaries", () => {
  assert.equal(nyseSession(at("2026-03-09T13:30:00Z")).state, "open");
  assert.equal(nyseSession(at("2026-03-09T13:29:00Z")).state, "pre");
  assert.equal(nyseSession(at("2026-11-02T14:30:00Z")).state, "open");
  assert.equal(nyseSession(at("2026-11-02T13:30:00Z")).state, "pre");
});

test("Yahoo marketState mapping", () => {
  assert.equal(stateFromMarketState("REGULAR"), "open");
  assert.equal(stateFromMarketState("PRE"), "pre");
  assert.equal(stateFromMarketState("POST"), "post");
  assert.equal(stateFromMarketState("CLOSED"), "closed");
  assert.equal(stateFromMarketState("POSTPOST"), "closed");
  assert.equal(stateFromMarketState(undefined), null);
});
