import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, normaliseArg } from "./commandParser.js";

test("FX arguments drop the Yahoo suffix the FX header shows", () => {
  // "USDJPY=X" used to pass through whole and become USDJPY=X=X on the screen.
  assert.deepEqual(parseCommand("WFX USDJPY=X").params, { pair: "USDJPY" });
  assert.deepEqual(parseCommand("usdjpy=x wfx").params, { pair: "USDJPY" });
  assert.deepEqual(parseCommand("WFX usd/jpy").params, { pair: "USDJPY" });
  assert.equal(normaliseArg("fx", "eurusd=x"), "EURUSD");
  // Not a six-letter pair: left as typed for the screen to report NOT FOUND.
  assert.equal(normaliseArg("fx", "YEN"), "YEN");
});

test("commodity arguments drop the Yahoo futures suffix", () => {
  assert.deepEqual(parseCommand("CMDT GC=F").params, { symbol: "GC" });
  assert.deepEqual(parseCommand("cl=f cmdt").params, { symbol: "CL" });
  assert.deepEqual(parseCommand("CMDT SI").params, { symbol: "SI" });
});

test("only the FX and commodity routes strip suffixes", () => {
  assert.deepEqual(parseCommand("DES GC=F").params, { symbol: "GC=F" });
  assert.deepEqual(parseCommand("DES BRK-B").params, { symbol: "BRK-B" });
});

test("crypto arguments are lowercased for the screen to match by id, ticker or name", () => {
  assert.deepEqual(parseCommand("CRYP ETH").params, { id: "eth" });
  assert.deepEqual(parseCommand("bitcoin cryp").params, { id: "bitcoin" });
});
