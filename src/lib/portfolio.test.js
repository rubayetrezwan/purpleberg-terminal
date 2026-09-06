import { test } from "node:test";
import assert from "node:assert/strict";
import {
  positionsFrom, enrichPositions, portfolioTotals, allocation,
  valueSeries, flowsByDate, alignFlows, dietzSeries, normalizeTo100,
  riskMetrics, beta, maxDrawdown, toCsv, parseCsv,
  sampleTransactions, localYmd, MIN_RISK_POINTS,
} from "./portfolio.js";

const tx = (over) => ({ id: over.id || Math.random().toString(36).slice(2), fees: 0, ...over });

test("average cost blends two buys and carries fees into the basis", () => {
  const { positions, rejected } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "AAPL", side: "buy", shares: 10, price: 100, fees: 5 }),
    tx({ date: "2026-02-05", symbol: "AAPL", side: "buy", shares: 10, price: 120 }),
  ]);
  assert.equal(rejected.length, 0);
  assert.equal(positions.length, 1);
  const p = positions[0];
  assert.equal(p.shares, 20);
  assert.equal(p.cost, 10 * 100 + 5 + 10 * 120);
  assert.equal(p.avgCost, (1005 + 1200) / 20);
  assert.equal(p.realised, 0);
});

test("a partial sell realises profit against average cost and leaves the rest", () => {
  const { positions } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "MSFT", side: "buy", shares: 10, price: 100 }),
    tx({ date: "2026-03-05", symbol: "MSFT", side: "sell", shares: 4, price: 150, fees: 2 }),
  ]);
  const p = positions[0];
  assert.equal(p.shares, 6);
  assert.equal(p.realised, 4 * (150 - 100) - 2);
  assert.equal(p.cost, 600);
  assert.equal(p.avgCost, 100);
});

test("a sell larger than the position is rejected, not clamped", () => {
  const { positions, rejected } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "NVDA", side: "buy", shares: 5, price: 100 }),
    tx({ date: "2026-02-05", symbol: "NVDA", side: "sell", shares: 9, price: 130 }),
  ]);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason, /position/);
  assert.equal(positions[0].shares, 5);
  assert.equal(positions[0].realised, 0);
});

test("transactions apply in date order however they arrive", () => {
  const { positions } = positionsFrom([
    tx({ date: "2026-03-05", symbol: "JPM", side: "sell", shares: 5, price: 200 }),
    tx({ date: "2026-01-05", symbol: "JPM", side: "buy", shares: 5, price: 100 }),
  ]);
  assert.equal(positions[0].shares, 0);
  assert.equal(positions[0].realised, 500);
});

test("a full exit keeps its realised P&L with no shares and no basis", () => {
  const { positions } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "XOM", side: "buy", shares: 3, price: 100 }),
    tx({ date: "2026-02-05", symbol: "XOM", side: "sell", shares: 3, price: 90 }),
  ]);
  const p = positions[0];
  assert.equal(p.shares, 0);
  assert.equal(p.cost, 0);
  assert.equal(p.avgCost, null);
  assert.equal(p.realised, -30);
});

test("rows without a live quote are excluded from the totals but counted as stale", () => {
  const { positions } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "AAPL", side: "buy", shares: 10, price: 100 }),
    tx({ date: "2026-01-05", symbol: "ZZZZ", side: "buy", shares: 10, price: 50 }),
  ]);
  const rows = enrichPositions(positions, new Map([["AAPL", { symbol: "AAPL", price: 120, prevClose: 110 }]]));
  const aapl = rows.find((r) => r.symbol === "AAPL");
  const zzzz = rows.find((r) => r.symbol === "ZZZZ");
  assert.equal(aapl.live, true);
  assert.equal(aapl.value, 1200);
  assert.equal(aapl.unrealised, 200);
  assert.equal(aapl.dayPnl, 100);
  assert.equal(zzzz.live, false);
  assert.equal(zzzz.value, null);

  const totals = portfolioTotals(rows);
  assert.equal(totals.value, 1200);
  assert.equal(totals.cost, 1000);
  assert.equal(totals.unrealised, 200);
  assert.equal(totals.returnPct, 20);
  assert.equal(totals.holdings, 2);
  assert.equal(totals.staleCount, 1);
});

test("totals report null rather than zero when nothing is live", () => {
  const { positions } = positionsFrom([tx({ date: "2026-01-05", symbol: "ZZZZ", side: "buy", shares: 1, price: 10 })]);
  const totals = portfolioTotals(enrichPositions(positions, new Map()));
  assert.equal(totals.unrealised, null);
  assert.equal(totals.returnPct, null);
  assert.equal(totals.dayPnl, null);
  assert.equal(totals.hasLive, false);
});

test("a live row with no previous close is left out of day P&L and counted", () => {
  // num(null) is 0, so a row like this used to be summed as a flat zero while
  // the header still showed a confident day move and nothing said a third of
  // the book was missing from it.
  const rows = [
    { symbol: "AAPL", shares: 10, cost: 1000, realised: 0, fees: 0, live: true, value: 1200, dayPnl: 100 },
    { symbol: "MSFT", shares: 2, cost: 800, realised: 0, fees: 0, live: true, value: 1000, dayPnl: null },
  ];
  const totals = portfolioTotals(rows);
  assert.equal(totals.dayPnl, 100);
  assert.equal(totals.dayPnlMissing, 1);
  assert.equal(totals.value, 2200, "value still covers both live rows");
});

test("day P&L is null, not zero, when no row has a previous close", () => {
  const totals = portfolioTotals([
    { symbol: "AAPL", shares: 1, cost: 10, realised: 0, fees: 0, live: true, value: 12, dayPnl: null },
  ]);
  assert.equal(totals.dayPnl, null);
  assert.equal(totals.dayPnlMissing, 1);
});

test("a day the portfolio was empty is not recorded as a flat return", () => {
  // Zero-base days used to be pushed in as r = 0, which padded the series past
  // the risk gate and diluted volatility with sessions that never happened.
  const series = [
    { date: "d1", value: 0 },
    { date: "d2", value: 0 },
    { date: "d3", value: 100 },
    { date: "d4", value: 110 },
  ];
  const { returns, index } = dietzSeries(series, { d3: 100 });
  assert.deepEqual(returns.map((r) => r.date), ["d3", "d4"], "d2 had nothing to return on");
  assert.equal(returns[0].r, 0, "the entry day is flat by the cost rule");
  assert.equal(returns[1].r.toFixed(4), (0.1).toFixed(4));
  assert.equal(index.length, series.length, "the index still has a point per session");
});

test("a symbol whose only transaction is a rejected sell leaves no position", () => {
  const { positions, rejected } = positionsFrom([
    tx({ date: "2026-01-05", symbol: "KO", side: "sell", shares: 5, price: 60 }),
  ]);
  assert.equal(rejected.length, 1);
  assert.deepEqual(positions, [], "no phantom zero-share row");
});

test("allocation weights live rows and groups by the caller's key", () => {
  const rows = [
    { symbol: "A", shares: 1, live: true, value: 300, sector: "Tech" },
    { symbol: "B", shares: 1, live: true, value: 100, sector: "Tech" },
    { symbol: "C", shares: 1, live: false, value: null, sector: "Energy" },
  ];
  const bySymbol = allocation(rows);
  assert.deepEqual(bySymbol.map((r) => [r.key, r.pct]), [["A", 75], ["B", 25]]);
  const bySector = allocation(rows, (r) => r.sector);
  assert.deepEqual(bySector, [{ key: "Tech", value: 400, pct: 100 }]);
});

test("the value series carries the last close forward across a price gap", () => {
  const txs = [tx({ date: "2026-01-02", symbol: "AAPL", side: "buy", shares: 10, price: 100 })];
  const closes = { AAPL: [{ date: "2026-01-02", close: 100 }, { date: "2026-01-05", close: 110 }] };
  const out = valueSeries(txs, closes, ["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06"]);
  assert.deepEqual(out.map((r) => r.value), [0, 1000, 1100, 1100]);
});

test("shares held on a date reflect only transactions up to that date", () => {
  const txs = [
    tx({ date: "2026-01-02", symbol: "AAPL", side: "buy", shares: 10, price: 100 }),
    tx({ date: "2026-01-06", symbol: "AAPL", side: "sell", shares: 10, price: 120 }),
  ];
  const closes = { AAPL: [{ date: "2026-01-02", close: 100 }, { date: "2026-01-06", close: 120 }] };
  const out = valueSeries(txs, closes, ["2026-01-02", "2026-01-06"]);
  assert.deepEqual(out.map((r) => r.value), [1000, 0]);
});

test("shares bought on a session are valued at cost that day, not at the close", () => {
  // Entered at 100 on a day that closed at 130: without this the chain would
  // book a 30% one-day gain that never happened to this holder.
  const txs = [tx({ date: "2026-01-02", symbol: "AAPL", side: "buy", shares: 10, price: 100 })];
  const closes = { AAPL: [{ date: "2026-01-02", close: 130 }, { date: "2026-01-05", close: 140 }] };
  const out = valueSeries(txs, closes, ["2026-01-01", "2026-01-02", "2026-01-05"]);
  assert.deepEqual(out.map((r) => r.value), [0, 1000, 1400]);
  const { returns } = dietzSeries(out, alignFlows(flowsByDate(txs), out.map((r) => r.date)));
  assert.equal(returns[0].r, 0, "the entry day is flat");
  assert.equal(returns[1].r.toFixed(4), (0.4).toFixed(4));
});

test("a sale on a session still marks the remaining shares to the close", () => {
  const txs = [
    tx({ date: "2026-01-02", symbol: "AAPL", side: "buy", shares: 10, price: 100 }),
    tx({ date: "2026-01-05", symbol: "AAPL", side: "sell", shares: 4, price: 150 }),
  ];
  const closes = { AAPL: [{ date: "2026-01-02", close: 100 }, { date: "2026-01-05", close: 140 }] };
  const out = valueSeries(txs, closes, ["2026-01-02", "2026-01-05"]);
  assert.deepEqual(out.map((r) => r.value), [1000, 6 * 140]);
});

test("a flow on a day the market was shut books to the next session", () => {
  const flows = { "2026-01-03": 500, "2026-01-05": 200 };
  assert.deepEqual(alignFlows(flows, ["2026-01-02", "2026-01-05", "2026-01-06"]), { "2026-01-05": 700 });
});

test("flows before the window are dropped, and after it are not invented", () => {
  const flows = { "2025-12-01": 999, "2026-01-05": 100, "2026-02-01": 50 };
  assert.deepEqual(alignFlows(flows, ["2026-01-02", "2026-01-05"]), { "2026-01-05": 100 });
});

test("cash flows are signed by side and include fees on the buy", () => {
  const flows = flowsByDate([
    tx({ date: "2026-01-02", symbol: "AAPL", side: "buy", shares: 10, price: 100, fees: 5 }),
    tx({ date: "2026-01-02", symbol: "MSFT", side: "buy", shares: 1, price: 200 }),
    tx({ date: "2026-03-02", symbol: "AAPL", side: "sell", shares: 5, price: 150, fees: 1 }),
  ]);
  assert.equal(flows["2026-01-02"], 1005 + 200);
  assert.equal(flows["2026-03-02"], -(750 - 1));
});

test("a Dietz day nets out the cash flow instead of counting it as a gain", () => {
  // Day 2 adds 1000 of new money and the portfolio closes at 2100, so the
  // return is 100 on a base of 2000, not 1100 on 1000.
  const series = [{ date: "d1", value: 1000 }, { date: "d2", value: 2100 }];
  const { returns, index } = dietzSeries(series, { d2: 1000 });
  assert.equal(returns.length, 1);
  assert.equal(returns[0].r.toFixed(6), (100 / 2000).toFixed(6));
  assert.equal(index[0].value, 100);
  assert.equal(index[1].value.toFixed(4), (100 * 1.05).toFixed(4));
});

test("a day whose base is zero yields no return at all, never an infinity", () => {
  const { returns, index } = dietzSeries([{ date: "d1", value: 0 }, { date: "d2", value: 0 }], {});
  assert.deepEqual(returns, [], "nothing to divide by means nothing to report");
  assert.deepEqual(index.map((p) => p.value), [100, 100], "the index still carries the level");
});

test("the benchmark normalises to 100 at its first usable close", () => {
  const out = normalizeTo100([{ date: "d1", close: 0 }, { date: "d2", close: 50 }, { date: "d3", close: 75 }]);
  assert.deepEqual(out, [{ date: "d2", value: 100 }, { date: "d3", value: 150 }]);
});

test("risk metrics need enough sessions before they say anything", () => {
  const few = Array.from({ length: MIN_RISK_POINTS - 1 }, (_, i) => ({ date: `d${i}`, r: 0.01 }));
  assert.equal(riskMetrics(few, []), null);
});

test("a flat series has zero volatility and no drawdown", () => {
  const returns = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, r: 0 }));
  const index = Array.from({ length: 31 }, (_, i) => ({ date: `d${i}`, value: 100 }));
  const m = riskMetrics(returns, index);
  assert.equal(m.vol, 0);
  assert.equal(m.maxDrawdown, 0);
  assert.equal(m.best, 0);
  assert.equal(m.worst, 0);
  assert.equal(m.sharpe, null);
  assert.equal(m.n, 30);
});

test("max drawdown measures peak to trough, not first to last", () => {
  assert.equal(maxDrawdown([{ value: 100 }, { value: 120 }, { value: 90 }, { value: 110 }]).toFixed(4), (-0.25).toFixed(4));
});

test("value at risk is the positive size of the fifth-percentile loss", () => {
  const rs = Array.from({ length: 100 }, (_, i) => ({ date: `d${i}`, r: (i - 50) / 1000 }));
  const m = riskMetrics(rs, [{ value: 100 }]);
  assert.ok(m.var95 > 0, "VaR is reported as a positive loss");
  assert.equal(m.worst, -0.05);
});

test("beta against the same series is one, and null without enough pairs", () => {
  const rs = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, r: ((i % 7) - 3) / 100 }));
  assert.equal(beta(rs, rs).toFixed(6), "1.000000");
  assert.equal(beta(rs.slice(0, 5), rs.slice(0, 5)), null);
  const flat = rs.map((x) => ({ date: x.date, r: 0 }));
  assert.equal(beta(rs, flat), null, "a benchmark with no variance has no beta");
});

test("beta pairs on date and ignores days the benchmark did not trade", () => {
  const port = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, r: ((i % 5) - 2) / 100 }));
  const bench = port.filter((_, i) => i % 2 === 0); // 20 shared dates
  assert.equal(typeof beta(port, bench), "number");
  const disjoint = port.map((x, i) => ({ date: `x${i}`, r: x.r }));
  assert.equal(beta(port, disjoint), null, "no shared dates means no beta");
});

test("CSV round trips and reports the line number of a bad row", () => {
  const txs = [
    tx({ date: "2026-01-05", symbol: "AAPL", side: "buy", shares: 10, price: 100, fees: 1 }),
    tx({ date: "2026-02-05", symbol: "MSFT", side: "sell", shares: 2, price: 400 }),
  ];
  const csv = toCsv(txs);
  assert.equal(csv.split("\n")[0], "date,symbol,side,shares,price,fees");
  const { rows, errors } = parseCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { date: "2026-01-05", symbol: "AAPL", side: "buy", shares: 10, price: 100, fees: 1 });

  const bad = parseCsv("date,symbol,side,shares,price,fees\n2026-01-05,AAPL,buy,10,100,0\nnope,AAPL,buy,1,1,0\n2026-01-06,AAPL,hold,1,1,0\n");
  assert.equal(bad.rows.length, 1);
  assert.deepEqual(bad.errors.map((e) => e.line), [3, 4]);
});

test("the CSV parser tolerates a missing fees column and blank lines", () => {
  const { rows, errors } = parseCsv("\n2026-01-05,AAPL,BUY,10,100\n\n");
  assert.equal(errors.length, 0);
  assert.deepEqual(rows[0], { date: "2026-01-05", symbol: "AAPL", side: "buy", shares: 10, price: 100, fees: 0 });
});

test("the sample portfolio is eight dated buys inside the last year", () => {
  const today = new Date(2026, 8, 4);
  const rows = sampleTransactions(today);
  assert.equal(rows.length, 8);
  assert.ok(rows.every((r) => r.side === "buy" && r.shares > 0 && r.price > 0));
  assert.ok(rows.every((r) => r.date < localYmd(today) && r.date > "2025-09-04"));
  assert.equal(new Set(rows.map((r) => r.id)).size, 8);
  const { rejected } = positionsFrom(rows);
  assert.equal(rejected.length, 0);
});

test("local calendar day, so a late-evening date is not tomorrow", () => {
  assert.equal(localYmd(new Date(2026, 0, 5, 21, 30)), "2026-01-05");
});
