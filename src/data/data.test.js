import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { scaleInterval } from "./polling.js";
import { dedupeSymbols, POOL_CAP, POOL_FIXED } from "./symbols.js";
import { nextFeedState, FEED_INITIAL } from "./feedState.js";
import { retainSymbol, releaseSymbol, poolExtras } from "./poolExtras.js";
import { newestWins, withRetry, HISTORY_RETRY_MS } from "./hooks.js";

test("scaleInterval scales by refresh setting with a 5s floor", () => {
  assert.equal(scaleInterval(15000, 15), 15000);
  assert.equal(scaleInterval(15000, 60), 60000);
  assert.equal(scaleInterval(15000, 30), 30000);
  assert.equal(scaleInterval(10000, 10), 6667);
  assert.equal(scaleInterval(5000, 10), 5000);
});

test("dedupeSymbols normalises, validates, dedupes, warns and caps keeping the head", () => {
  assert.deepEqual(dedupeSymbols([["aapl", "AAPL"], ["msft", " ", "bad symbol!"], "^GSPC", null]), ["AAPL", "MSFT", "^GSPC"]);
  assert.deepEqual(dedupeSymbols(["nvda", ["NVDA", "nvda"]]), ["NVDA"]);
  const warn = mock.method(console, "warn", () => {});
  const user = ["U1", "U2", "U3"];
  const many = Array.from({ length: POOL_CAP + 50 }, (_, i) => `S${i}`);
  const out = dedupeSymbols([POOL_FIXED, user, many]);
  assert.equal(out.length, POOL_CAP);
  assert.deepEqual(out.slice(0, 4), ["^GSPC", "U1", "U2", "U3"]);
  assert.equal(warn.mock.callCount(), 1);
  warn.mock.restore();
  assert.deepEqual(POOL_FIXED, ["^GSPC"]);
});

test("feed state goes offline after two failures and back online on success", () => {
  const t = 1000;
  const one = nextFeedState(FEED_INITIAL, false, t);
  assert.equal(one.status, "online");
  assert.equal(one.failures, 1);
  const two = nextFeedState(one, false, t + 1);
  assert.equal(two.status, "offline");
  assert.equal(two.since, t + 1);
  const three = nextFeedState(two, false, t + 2);
  assert.equal(three, two);
  const back = nextFeedState(three, true, t + 3);
  assert.deepEqual(back, { status: "online", failures: 0, since: null });
  assert.equal(nextFeedState(back, true, t + 4), back);
});

test("poolExtras is ref-counted", () => {
  retainSymbol("nvda");
  retainSymbol("NVDA");
  assert.equal(poolExtras.get().counts.NVDA, 2);
  releaseSymbol("NVDA");
  assert.equal(poolExtras.get().counts.NVDA, 1);
  releaseSymbol("NVDA");
  assert.equal("NVDA" in poolExtras.get().counts, false);
  releaseSymbol("NVDA");
  assert.deepEqual(poolExtras.get().counts, {});
  releaseSymbol("");
  releaseSymbol("NEVER_HELD");
  assert.deepEqual(poolExtras.get().counts, {});
});

test("newestWins lets slow answers land and drops only ones older than the last applied", () => {
  const gate = newestWins();
  const a = gate.issue();
  const b = gate.issue();
  const c = gate.issue();
  // Three ticks fired before any answer came back: the first answer to
  // arrive still lands, which the old latest-request-only rule refused.
  assert.equal(gate.accept(a), true);
  assert.equal(gate.accept(c), true);
  assert.equal(gate.accept(b), false, "b is older than c, which already landed");
  const d = gate.issue();
  assert.equal(gate.accept(d), true);
});

test("withRetry retries thrown errors with the backoff, then gives up", async () => {
  const waits = [];
  const wait = async (ms) => { waits.push(ms); };
  let calls = 0;
  const flaky = async () => { calls += 1; if (calls < 3) throw new Error("offline"); return [1, 2]; };
  assert.deepEqual(await withRetry(flaky, { wait }), [1, 2]);
  assert.equal(calls, 3);
  assert.deepEqual(waits, HISTORY_RETRY_MS.slice(0, 2));

  waits.length = 0;
  calls = 0;
  const down = async () => { calls += 1; throw new Error("still offline"); };
  await assert.rejects(withRetry(down, { wait }), /still offline/);
  assert.equal(calls, HISTORY_RETRY_MS.length + 1);
  assert.deepEqual(waits, HISTORY_RETRY_MS);
});

test("withRetry retries an empty series like an error and stops when told to", async () => {
  const wait = async () => {};
  let calls = 0;
  assert.deepEqual(await withRetry(async () => { calls += 1; return []; }, { wait }), []);
  assert.equal(calls, HISTORY_RETRY_MS.length + 1, "an empty series is retried, then returned");

  calls = 0;
  const late = async () => { calls += 1; return calls < 2 ? [] : [{ close: 1 }]; };
  assert.deepEqual(await withRetry(late, { wait }), [{ close: 1 }]);
  assert.equal(calls, 2);

  calls = 0;
  let stopped = false;
  const down = async () => { calls += 1; stopped = true; throw new Error("offline"); };
  await assert.rejects(withRetry(down, { wait, stopped: () => stopped }));
  assert.equal(calls, 1, "a cancelled load does not keep retrying");
});
