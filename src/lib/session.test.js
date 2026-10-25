import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { nyseSession, etParts, etOffsetMinutes, etInstant, nextTradingDay, previousTradingDay, tradeDate, isTradingDay, stateFromMarketState, displayState } from "./session.js";

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
  assert.equal(s.countdownLabel, "closes in");
  assert.equal(iso(s.countdownTo), "2026-09-04T20:00:00.000Z");

  s = nyseSession(at("2026-09-04T12:00:00Z")); // 08:00 EDT
  assert.equal(s.state, "pre");
  assert.equal(iso(s.countdownTo), "2026-09-04T13:30:00.000Z");

  s = nyseSession(at("2026-09-04T21:00:00Z")); // 17:00 EDT
  assert.equal(s.state, "post");
  assert.equal(s.countdownLabel, "opens in");
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

test("after hours end at 17:00 ET on early close days", () => {
  assert.equal(nyseSession(at("2026-11-27T21:59:00Z")).state, "post"); // 16:59 EST
  const s = nyseSession(at("2026-11-27T22:00:00Z")); // 17:00 EST
  assert.equal(s.state, "closed");
  assert.equal(iso(s.countdownTo), "2026-11-30T14:30:00.000Z");
  assert.equal(nyseSession(at("2026-11-28T00:30:00Z")).state, "closed"); // 19:30 EST
});

test("the label trusts Yahoo's marketState only while the quote is fresh", () => {
  // Saturday 16:00 ET (02:00 Sunday in Dhaka) with Friday's REGULAR kept from a failed poll.
  const clock = nyseSession(at("2026-10-24T20:00:00Z")).state;
  assert.equal(clock, "closed");
  assert.equal(displayState(clock, "REGULAR", false), "closed");
  // Fresh data wins, so an unscheduled closure shows up.
  assert.equal(displayState("open", "CLOSED", true), "closed");
  assert.equal(displayState("pre", "PRE", false), "pre");
  assert.equal(displayState("open", undefined, true), "open");
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

test("session boundaries are half-open at 04:00, 16:00, and 20:00 ET", () => {
  assert.equal(nyseSession(at("2026-09-04T08:00:00Z")).state, "pre");
  assert.equal(nyseSession(at("2026-09-04T07:59:59Z")).state, "closed");
  assert.equal(nyseSession(at("2026-09-04T20:00:00Z")).state, "post");
  assert.equal(nyseSession(at("2026-09-04T19:59:59Z")).state, "open");
  assert.equal(nyseSession(at("2026-09-05T00:00:00Z")).state, "closed");
  assert.equal(nyseSession(at("2026-09-04T23:59:59Z")).state, "post");
});

test("midnight in New York reports hour 0, not 24", () => {
  assert.equal(etParts(at("2026-09-04T04:00:00Z")).hour, 0);
});

test("dates past the holiday table still resolve and are flagged", () => {
  const warn = mock.method(console, "warn", () => {});
  const s = nyseSession(at("2028-12-25T15:00:00Z"));
  assert.equal(s.tableStale, true);
  assert.ok(s.countdownTo instanceof Date && !Number.isNaN(s.countdownTo.getTime()));
  assert.equal(nyseSession(at("2026-09-04T14:00:00Z")).tableStale, false);
  warn.mock.restore();
  assert.equal(nextTradingDay("2027-12-24"), "2027-12-27");
});

test("previousTradingDay steps back over weekends and holidays", () => {
  assert.equal(previousTradingDay("2026-10-26"), "2026-10-23"); // Monday back to Friday
  assert.equal(previousTradingDay("2027-01-19"), "2027-01-15"); // over MLK Day and the weekend
  assert.equal(previousTradingDay("2026-11-27"), "2026-11-25"); // over Thanksgiving
});

test("tradeDate is the New York trading day, not the local calendar day", () => {
  // Tue 00:30 in Dhaka is still Monday afternoon in New York.
  assert.equal(tradeDate(at("2026-10-26T18:30:00Z")), "2026-10-26");
  // Saturday afternoon in Dhaka: the last session was Friday.
  assert.equal(tradeDate(at("2026-10-24T08:30:00Z")), "2026-10-23");
  // 22:00 Monday in Los Angeles is 01:00 Tuesday in New York, before the open.
  assert.equal(tradeDate(at("2026-10-27T05:00:00Z")), "2026-10-26");
  // Monday before and after the 09:30 open.
  assert.equal(tradeDate(at("2026-10-26T13:00:00Z")), "2026-10-23");
  assert.equal(tradeDate(at("2026-10-26T13:30:00Z")), "2026-10-26");
  // Thanksgiving: no session, so the day before.
  assert.equal(tradeDate(at("2026-11-26T17:00:00Z")), "2026-11-25");
});
