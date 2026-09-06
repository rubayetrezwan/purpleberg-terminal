import { newId } from "./id.js";
import { TICKER_RE } from "./ticker.js";

// Portfolio accounting on average cost. Transactions are the source of truth:
//   { id, date: "YYYY-MM-DD", symbol, side: "buy"|"sell", shares, price, fees }
// Everything here is pure: no clock, no storage, no DOM. Prices and dates are
// arguments so tests can pin them.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Local calendar day. A 21:00 transaction in New York belongs to that day, not
// to tomorrow, so this never goes through UTC.
export function localYmd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Date order, with the original order breaking ties so two transactions on the
// same day apply as they were entered.
export function sortTransactions(transactions) {
  return (Array.isArray(transactions) ? transactions : [])
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map((x) => x.t);
}

const EPS = 1e-9;

/**
 * Derive positions from transactions.
 * Buy:  shares += s, cost += s * price + fees.
 * Sell: realises s * (price - avgCost) - fees, cost -= s * avgCost, shares -= s.
 * A sell larger than the position is a data error, not a short: the row is
 * rejected whole so the remaining cost basis stays truthful.
 * Returns { positions, rejected }. Positions include closed ones (shares 0)
 * because their realised P&L still belongs to the totals.
 */
export function positionsFrom(transactions) {
  const bySymbol = new Map();
  const rejected = [];
  for (const t of sortTransactions(transactions)) {
    const symbol = String(t.symbol || "").trim().toUpperCase();
    const shares = num(t.shares);
    const price = num(t.price);
    const fees = num(t.fees);
    if (!symbol) { rejected.push({ transaction: t, reason: "missing symbol" }); continue; }
    if (!DATE_RE.test(String(t.date))) { rejected.push({ transaction: t, reason: "bad date" }); continue; }
    if (!(shares > 0) || !(price > 0) || fees < 0) { rejected.push({ transaction: t, reason: "bad amount" }); continue; }
    if (t.side !== "buy" && t.side !== "sell") { rejected.push({ transaction: t, reason: "bad side" }); continue; }

    // The entry is created only once a transaction is actually applied, so a
    // symbol whose only row is a rejected sell leaves no phantom position.
    let p = bySymbol.get(symbol);
    if (t.side === "sell" && (!p || shares > p.shares + EPS)) {
      rejected.push({ transaction: t, reason: "sell exceeds the position held on that date" });
      continue;
    }
    if (!p) {
      p = { symbol, shares: 0, cost: 0, realised: 0, fees: 0, buys: 0, sells: 0, first: t.date, last: t.date };
      bySymbol.set(symbol, p);
    }
    if (t.side === "buy") {
      p.shares += shares;
      p.cost += shares * price + fees;
      p.buys += 1;
    } else {
      const avg = p.shares > 0 ? p.cost / p.shares : 0;
      p.realised += shares * (price - avg) - fees;
      p.cost -= shares * avg;
      p.shares -= shares;
      p.sells += 1;
      // Float dust would otherwise leave a position of 1e-15 shares showing up
      // as open with a nonsense average cost.
      if (p.shares <= EPS) { p.shares = 0; p.cost = 0; }
    }
    p.fees += fees;
    p.last = t.date;
  }
  const positions = [...bySymbol.values()].map((p) => ({
    ...p,
    avgCost: p.shares > 0 ? p.cost / p.shares : null,
  }));
  return { positions, rejected };
}

/**
 * Attach live quote figures. `bySymbol` is a Map or plain object of quotes.
 * A position with no live price keeps null figures and `live: false` so the
 * caller can show an em dash instead of pretending the P&L is flat.
 */
export function enrichPositions(positions, bySymbol) {
  const lookup = (s) =>
    bySymbol instanceof Map ? bySymbol.get(s) : bySymbol ? bySymbol[s] : null;
  return (Array.isArray(positions) ? positions : []).map((p) => {
    const q = lookup(p.symbol);
    const price = q && Number(q.price) > 0 ? Number(q.price) : null;
    const prevClose = q && Number(q.prevClose) > 0 ? Number(q.prevClose) : null;
    const live = price != null && p.shares > 0;
    const value = live ? price * p.shares : null;
    const unrealised = live ? value - p.cost : null;
    return {
      ...p,
      name: (q && q.name) || p.symbol,
      price,
      prevClose,
      changePercent: q && Number.isFinite(Number(q.changePercent)) ? Number(q.changePercent) : null,
      live,
      value,
      unrealised,
      unrealisedPct: live && p.cost > 0 ? (unrealised / p.cost) * 100 : null,
      dayPnl: live && prevClose != null ? (price - prevClose) * p.shares : null,
    };
  });
}

/**
 * Aggregate. Market figures cover live rows only, so a partial quote failure
 * cannot drag the total towards zero; realised P&L covers every row, including
 * positions that are fully closed.
 */
export function portfolioTotals(rows) {
  const all = Array.isArray(rows) ? rows : [];
  const open = all.filter((r) => r.shares > 0);
  const live = open.filter((r) => r.live);
  const sum = (f) => live.reduce((a, r) => a + num(f(r)), 0);
  const value = sum((r) => r.value);
  const cost = sum((r) => r.cost);
  // A row can have a price but no previous close, which leaves it live with no
  // day P&L. num(null) would fold it in as a flat zero, so day P&L covers only
  // the rows that have one and reports how many it left out.
  const withDay = live.filter((r) => r.dayPnl != null);
  return {
    value: live.length ? value : null,
    cost: live.length ? cost : null,
    unrealised: live.length ? value - cost : null,
    returnPct: live.length && cost > 0 ? ((value - cost) / cost) * 100 : null,
    dayPnl: withDay.length ? withDay.reduce((a, r) => a + num(r.dayPnl), 0) : null,
    dayPnlMissing: live.length - withDay.length,
    realised: all.reduce((a, r) => a + num(r.realised), 0),
    fees: all.reduce((a, r) => a + num(r.fees), 0),
    holdings: open.length,
    staleCount: open.length - live.length,
    hasLive: live.length > 0,
  };
}

/**
 * Weights over live rows. `keyFn` groups them: by symbol for the holding
 * split, by sector for the sector split. Rows without a live value have no
 * defensible weight, so they are left out rather than weighted at cost.
 */
export function allocation(rows, keyFn = (r) => r.symbol) {
  const live = (Array.isArray(rows) ? rows : []).filter((r) => r.live && num(r.value) > 0);
  const total = live.reduce((a, r) => a + num(r.value), 0);
  if (!(total > 0)) return [];
  const byKey = new Map();
  for (const r of live) {
    const k = keyFn(r) || "UNKNOWN";
    byKey.set(k, (byKey.get(k) || 0) + num(r.value));
  }
  return [...byKey.entries()]
    .map(([key, value]) => ({ key, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Portfolio value on each of `dates`, using the shares held on that date and
 * the last close at or before it. `closesBySymbol` is { SYM: [{date, close}] }
 * ascending. Gaps carry the previous close forward; a symbol with no close yet
 * contributes nothing rather than a guess. Pass accepted transactions only.
 *
 * Shares bought on one of these sessions are valued at what they cost that
 * day, not at that day's close. Otherwise the gap between an entry price and
 * the close would show up as a one-day return, which is how a rough cost basis
 * (or a migrated holding dated today) turns into a fake several-hundred-percent
 * day. From the next session on, everything is marked to the close.
 */
export function valueSeries(transactions, closesBySymbol, dates) {
  const txs = sortTransactions(transactions);
  const symbols = [...new Set(txs.map((t) => String(t.symbol || "").toUpperCase()))].filter(Boolean);
  const closes = new Map(symbols.map((s) => [s, (closesBySymbol && closesBySymbol[s]) || []]));
  const cursor = new Map(symbols.map((s) => [s, { i: 0, last: null }]));
  const held = new Map(symbols.map((s) => [s, 0]));
  let ti = 0;
  const out = [];
  for (const date of Array.isArray(dates) ? dates : []) {
    const boughtToday = new Map();
    while (ti < txs.length && txs[ti].date <= date) {
      const t = txs[ti++];
      const s = String(t.symbol || "").toUpperCase();
      const q = num(t.shares);
      if (t.date === date && t.side === "buy") {
        const e = boughtToday.get(s) || { shares: 0, amount: 0 };
        e.shares += q;
        e.amount += q * num(t.price);
        boughtToday.set(s, e);
      }
      held.set(s, (held.get(s) || 0) + (t.side === "sell" ? -q : q));
    }
    let value = 0;
    for (const s of symbols) {
      const c = cursor.get(s);
      const rows = closes.get(s);
      while (c.i < rows.length && rows[c.i].date <= date) {
        const v = Number(rows[c.i].close);
        if (Number.isFinite(v) && v > 0) c.last = v;
        c.i++;
      }
      const fresh = boughtToday.get(s);
      const marked = (held.get(s) || 0) - (fresh ? fresh.shares : 0);
      if (marked > EPS && c.last != null) value += marked * c.last;
      if (fresh) value += fresh.amount;
    }
    out.push({ date, value });
  }
  return out;
}

/**
 * Book every cash flow to a session in `dates`. A trade entered on a weekend,
 * a holiday, or any day the series does not carry belongs to the next session,
 * or the chain would read the purchase itself as a gain. Flows before the
 * window are dropped: those shares are already inside the opening value, so
 * counting the money again would show a large false loss on day one.
 */
export function alignFlows(flows, dates) {
  const list = Array.isArray(dates) ? dates : [];
  const out = {};
  if (!list.length) return out;
  const first = list[0];
  let i = 0;
  for (const key of Object.keys(flows || {}).sort()) {
    if (key < first) continue;
    while (i < list.length && list[i] < key) i += 1;
    if (i >= list.length) break; // after the window: no session left to book it to
    out[list[i]] = (out[list[i]] || 0) + num(flows[key]);
  }
  return out;
}

/**
 * Net cash into the portfolio per date: a buy is `shares * price + fees`, a
 * sell is negative `shares * price - fees`. Used as the Dietz cash flow, which
 * is what keeps a deposit from reading as a gain.
 */
export function flowsByDate(transactions) {
  const out = {};
  for (const t of sortTransactions(transactions)) {
    const gross = num(t.shares) * num(t.price);
    const fees = num(t.fees);
    const signed = t.side === "sell" ? -(gross - fees) : gross + fees;
    out[t.date] = (out[t.date] || 0) + signed;
  }
  return out;
}

/**
 * One-day Dietz with the day's cash flow at the start of the day:
 *   r = (V(d) - V(d-1) - CF(d)) / (V(d-1) + CF(d))
 * chained into an index starting at 100. A day whose base is zero or negative
 * has no meaningful return (the position opened that day), so it reads flat.
 */
export function dietzSeries(series, flows = {}) {
  const list = Array.isArray(series) ? series : [];
  const returns = [];
  const index = [];
  let level = 100;
  for (let i = 0; i < list.length; i++) {
    const cur = list[i];
    if (i === 0) { index.push({ date: cur.date, value: level }); continue; }
    const prev = list[i - 1];
    const cf = num(flows[cur.date]);
    const base = num(prev.value) + cf;
    // No base means the portfolio did not exist that day (before the first
    // trade, or between a full exit and a later re-entry). Recording it as a
    // flat return would pad the series past the risk gate and dilute
    // volatility with sessions that never happened, so the index carries the
    // level forward and the return is simply not reported.
    if (base <= EPS) {
      index.push({ date: cur.date, value: level });
      continue;
    }
    const r = (num(cur.value) - num(prev.value) - cf) / base;
    returns.push({ date: cur.date, r });
    level *= 1 + r;
    index.push({ date: cur.date, value: level });
  }
  return { returns, index };
}

// Benchmark on the same dates, rebased to 100 at its first usable close.
export function normalizeTo100(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => Number(r.close) > 0);
  if (!list.length) return [];
  const base = Number(list[0].close);
  return list.map((r) => ({ date: r.date, value: (Number(r.close) / base) * 100 }));
}

const asReturns = (rs) =>
  (Array.isArray(rs) ? rs : [])
    .map((x) => (typeof x === "number" ? x : Number(x && x.r)))
    .filter((v) => Number.isFinite(v));

// Linear-interpolated quantile of an ascending array.
export function quantile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const pos = (sortedAsc.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

// Deepest peak-to-trough fall of an index, as a negative fraction.
export function maxDrawdown(index) {
  const vals = (Array.isArray(index) ? index : [])
    .map((x) => (typeof x === "number" ? x : Number(x && x.value)))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (!vals.length) return null;
  let peak = -Infinity;
  let mdd = 0;
  for (const v of vals) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
}

// Below this, a standard deviation says more about the sample size than about
// the portfolio, so the whole risk tab holds back.
export const MIN_RISK_POINTS = 20;

/**
 * Annualised volatility, max drawdown, best and worst day, 1-day 95%
 * historical VaR, and Sharpe. `rf` is the annual risk-free rate as a fraction
 * (the 3-month bill / 100). Null under MIN_RISK_POINTS returns.
 */
export function riskMetrics(returns, index, { rf = 0 } = {}) {
  const rs = asReturns(returns);
  if (rs.length < MIN_RISK_POINTS) return null;
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const variance = rs.reduce((a, b) => a + (b - mean) ** 2, 0) / (rs.length - 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252);
  const sorted = [...rs].sort((a, b) => a - b);
  return {
    n: rs.length,
    mean,
    vol,
    maxDrawdown: maxDrawdown(index),
    best: sorted[sorted.length - 1],
    worst: sorted[0],
    var95: -quantile(sorted, 0.05),
    sharpe: vol > 0 ? (mean * 252 - rf) / vol : null,
  };
}

/**
 * Beta to the benchmark: covariance over benchmark variance on the dates both
 * series share. Null under MIN_RISK_POINTS pairs, or when the benchmark did
 * not move at all.
 */
export function beta(portfolioReturns, benchmarkReturns) {
  const bench = new Map(
    (Array.isArray(benchmarkReturns) ? benchmarkReturns : []).map((x) => [x.date, Number(x.r)])
  );
  const pairs = [];
  for (const p of Array.isArray(portfolioReturns) ? portfolioReturns : []) {
    const b = bench.get(p.date);
    if (Number.isFinite(Number(p.r)) && Number.isFinite(b)) pairs.push([Number(p.r), b]);
  }
  if (pairs.length < MIN_RISK_POINTS) return null;
  const meanP = pairs.reduce((a, [p]) => a + p, 0) / pairs.length;
  const meanB = pairs.reduce((a, [, b]) => a + b, 0) / pairs.length;
  let cov = 0;
  let varB = 0;
  for (const [p, b] of pairs) {
    cov += (p - meanP) * (b - meanB);
    varB += (b - meanB) ** 2;
  }
  return varB > EPS ? cov / varB : null;
}

// ── CSV ─────────────────────────────────────────────────
export const CSV_HEADER = "date,symbol,side,shares,price,fees";

export function toCsv(transactions) {
  const rows = sortTransactions(transactions).map((t) =>
    [
      t.date,
      String(t.symbol || "").toUpperCase(),
      t.side,
      num(t.shares),
      num(t.price),
      num(t.fees),
    ].join(",")
  );
  return [CSV_HEADER, ...rows].join("\n");
}

/**
 * Parse `date,symbol,side,shares,price,fees`. Never throws: every bad row
 * comes back in `errors` with its 1-based line number so the import preview
 * can name it. The fees column is optional.
 */
export function parseCsv(text) {
  const rows = [];
  const errors = [];
  const lines = String(text == null ? "" : text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.toLowerCase().replace(/\s+/g, "").startsWith("date,symbol")) return;
    const parts = line.split(",").map((s) => s.trim());
    const [date, rawSymbol = "", rawSide = "", rawShares = "", rawPrice = "", rawFees = ""] = parts;
    const symbol = rawSymbol.toUpperCase();
    const side = rawSide.toLowerCase();
    const shares = Number(rawShares);
    const price = Number(rawPrice);
    const fees = rawFees === "" ? 0 : Number(rawFees);
    let reason = null;
    if (parts.length < 5) reason = "needs date, symbol, side, shares, price";
    else if (!DATE_RE.test(date)) reason = "date must be YYYY-MM-DD";
    else if (!TICKER_RE.test(symbol)) reason = "symbol is not a ticker";
    else if (side !== "buy" && side !== "sell") reason = "side must be buy or sell";
    else if (!Number.isFinite(shares) || shares <= 0) reason = "shares must be a positive number";
    else if (!Number.isFinite(price) || price <= 0) reason = "price must be a positive number";
    else if (!Number.isFinite(fees) || fees < 0) reason = "fees cannot be negative";
    if (reason) errors.push({ line: i + 1, text: line, reason });
    else rows.push({ date, symbol, side, shares, price, fees });
  });
  return { rows, errors };
}

// ── Sample portfolio ────────────────────────────────────
// Offered from the empty state so the screen can be tried without typing.
// These prices are round fallbacks; the screen replaces each one with the
// actual close on that date so the sample basis is not made up.
const SAMPLE = [
  [330, "AAPL", 40, 190],
  [300, "MSFT", 12, 430],
  [250, "NVDA", 25, 250],
  [200, "JPM", 30, 280],
  [150, "XOM", 60, 115],
  [90, "AAPL", 20, 205],
  [45, "NVDA", 15, 300],
  [20, "MSFT", 8, 470],
];

export function sampleTransactions(today = new Date()) {
  return SAMPLE.map(([daysAgo, symbol, shares, price]) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    return { id: newId(), date: localYmd(d), symbol, side: "buy", shares, price, fees: 0, note: "sample" };
  });
}
