import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPath, matchRoute, parseQuery, buildPath } from "./match.js";
import { ROUTES, routeByMnemonic, routeByName, pathFor, isMnemonic } from "./routes.js";

test("matchPath: static, params, optional params, trailing slash", () => {
  assert.deepEqual(matchPath("/", "/"), {});
  assert.deepEqual(matchPath("/screener", "/screener"), {});
  assert.deepEqual(matchPath("/screener", "/screener/"), {});
  assert.equal(matchPath("/screener", "/screener/x"), null);
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities"), {});
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities/AAPL"), { symbol: "AAPL" });
  assert.deepEqual(matchPath("/equities/:symbol?", "/equities/%5EGSPC"), { symbol: "^GSPC" });
  assert.equal(matchPath("/equities/:symbol?", "/equities/AAPL/extra"), null);
  assert.equal(matchPath("/a/:id", "/a"), null);
});

test("parseQuery decodes and ignores empty input", () => {
  assert.deepEqual(parseQuery("?a=AAPL&b=MSFT&range=3mo"), { a: "AAPL", b: "MSFT", range: "3mo" });
  assert.deepEqual(parseQuery(""), {});
  assert.deepEqual(parseQuery("?q=hello%20world"), { q: "hello world" });
});

test("matchRoute walks the table in order and returns params and query", () => {
  const m = matchRoute(ROUTES, "/equities/%5EGSPC", "?tab=chart");
  assert.equal(m.route.name, "equities");
  assert.deepEqual(m.params, { symbol: "^GSPC" });
  assert.deepEqual(m.query, { tab: "chart" });
  assert.equal(matchRoute(ROUTES, "/", "").route.name, "dashboard");
  assert.equal(matchRoute(ROUTES, "/fx", "").route.name, "fx");
  assert.equal(matchRoute(ROUTES, "/nope", ""), null);
});

test("buildPath encodes params and drops empty query values", () => {
  assert.equal(buildPath("/equities/:symbol?", { symbol: "^GSPC" }), "/equities/%5EGSPC");
  assert.equal(buildPath("/equities/:symbol?", {}), "/equities");
  assert.equal(buildPath("/compare", {}, { a: "AAPL", b: "MSFT", range: "" }), "/compare?a=AAPL&b=MSFT");
  assert.equal(buildPath("/", {}), "/");
  assert.throws(() => buildPath("/x/:id", {}), /missing param id/);
});

test("route table helpers", () => {
  assert.equal(routeByMnemonic("des").name, "equities");
  assert.equal(routeByMnemonic("nope"), null);
  assert.equal(routeByName("rates").mnemonic, "YAS");
  assert.equal(isMnemonic("WEI"), true);
  assert.equal(isMnemonic("eco"), true);
  assert.equal(isMnemonic("AAPL"), false);
  assert.equal(pathFor("equities", { symbol: "CL=F" }), "/equities/CL%3DF");
  assert.equal(pathFor("rates", {}, { tab: "calendar" }), "/rates?tab=calendar");
  assert.equal(ROUTES.length, 12);
});
