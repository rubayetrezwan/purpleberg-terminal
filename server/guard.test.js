import { test } from "node:test";
import assert from "node:assert/strict";
import { safeHttpUrl, limitUnknownSymbols } from "./guard.js";

test("safeHttpUrl keeps absolute http and https URLs", () => {
  assert.equal(safeHttpUrl("https://www.apple.com"), "https://www.apple.com/");
  assert.equal(safeHttpUrl("http://example.com/a?b=1#c"), "http://example.com/a?b=1#c");
  assert.equal(safeHttpUrl("  https://example.com/x  "), "https://example.com/x");
});

test("safeHttpUrl drops script and other non-web schemes", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("JavaScript:alert(1)"), "");
  assert.equal(safeHttpUrl(" \tjavascript:alert(1)"), "");
  assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(safeHttpUrl("vbscript:msgbox(1)"), "");
  assert.equal(safeHttpUrl("file:///etc/passwd"), "");
});

test("safeHttpUrl drops relative, malformed and non-string values", () => {
  assert.equal(safeHttpUrl("/news/story"), "");
  assert.equal(safeHttpUrl("www.apple.com"), "");
  assert.equal(safeHttpUrl("http://"), "");
  assert.equal(safeHttpUrl(""), "");
  assert.equal(safeHttpUrl(null), "");
  assert.equal(safeHttpUrl(undefined), "");
  assert.equal(safeHttpUrl({ href: "https://x.com" }), "");
});

test("limitUnknownSymbols keeps every known symbol and caps the rest", () => {
  const known = new Set(["AAPL", "MSFT", "^GSPC"]);
  const r = limitUnknownSymbols(["ZZZ1", "AAPL", "ZZZ2", "MSFT", "ZZZ3", "^GSPC"], known, 2);
  assert.deepEqual(r.symbols, ["ZZZ1", "AAPL", "ZZZ2", "MSFT", "^GSPC"]);
  assert.equal(r.unknown, 2);
});

test("limitUnknownSymbols with only known symbols changes nothing", () => {
  const known = new Set(["AAPL", "MSFT"]);
  const r = limitUnknownSymbols(["MSFT", "AAPL"], known, 0);
  assert.deepEqual(r.symbols, ["MSFT", "AAPL"]);
  assert.equal(r.unknown, 0);
});
