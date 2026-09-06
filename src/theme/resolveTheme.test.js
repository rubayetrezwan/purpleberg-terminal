import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, resolveDensity } from "./resolveTheme.js";

test("explicit themes win, system follows the OS", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("garbage", true), "dark");
});

test("density falls back to compact", () => {
  assert.equal(resolveDensity("comfortable"), "comfortable");
  assert.equal(resolveDensity("compact"), "compact");
  assert.equal(resolveDensity(undefined), "compact");
});
