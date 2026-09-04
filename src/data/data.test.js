import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleInterval } from "./polling.js";
import { dedupeSymbols, POOL_CAP } from "./symbols.js";
import { nextFeedState, FEED_INITIAL } from "./feedState.js";
import { retainSymbol, releaseSymbol, poolExtras } from "./poolExtras.js";

test("scaleInterval scales by refresh setting with a 5s floor", () => {
  assert.equal(scaleInterval(15000, 15), 15000);
  assert.equal(scaleInterval(15000, 60), 60000);
  assert.equal(scaleInterval(15000, 30), 30000);
  assert.equal(scaleInterval(10000, 10), 6667);
  assert.equal(scaleInterval(5000, 10), 5000);
});

test("dedupeSymbols normalises, validates, dedupes, caps", () => {
  assert.deepEqual(dedupeSymbols([["aapl", "AAPL"], ["msft", " ", "bad symbol!"], "^GSPC", null]), ["AAPL", "MSFT", "^GSPC"]);
  const many = Array.from({ length: POOL_CAP + 50 }, (_, i) => `S${i}`);
  assert.equal(dedupeSymbols([many]).length, POOL_CAP);
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
  assert.equal(three.since, t + 1);
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
});
