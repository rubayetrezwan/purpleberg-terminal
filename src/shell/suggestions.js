import { ROUTES } from "../router/routes.js";
import { filterRows } from "../lib/symbolSearch.js";
import { exchangeLabel } from "../lib/exchange.js";

// Suggestion rows for the command line. Plain data (no closures) so it is
// testable; CommandLine.jsx maps `kind` to an action.
export const COMMAND_ITEMS = [
  { id: "cmd:THEME", kind: "command", command: "theme", label: "THEME", sub: "Cycle dark, light, system" },
  { id: "cmd:DENSITY", kind: "command", command: "density", label: "DENSITY", sub: "Toggle compact and comfortable" },
  { id: "cmd:HELP", kind: "command", command: "help", label: "HELP", sub: "Keyboard shortcuts" },
];

const fnItem = (r, params = {}, query = {}) => ({
  id: `fn:${r.mnemonic}`, kind: "function", label: r.mnemonic, sub: `${r.label} · ${r.title}`, routeName: r.name, params, query,
});

const symItem = (kind, row) => ({
  id: `${kind}:${row.symbol}`, kind, label: row.symbol, sub: row.name || "", symbol: row.symbol,
  price: row.price, changePercent: row.changePercent, right: exchangeLabel(row.exchange),
});

// Yahoo ranks by its own relevance, which put Under Armour (UA) above ARMP
// for "ARM". A ticker that is or starts with the text leads; the rest keep
// Yahoo's order.
const symbolRank = (symbol, sq) => (symbol === sq ? 0 : symbol.startsWith(sq) ? 1 : 2);
function rankBySymbol(rows, sq) {
  return rows
    .map((r, i) => ({ r, i, k: symbolRank(String(r.symbol || ""), sq) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}

// A bare word that could be a US ticker: one to five letters, optionally with
// a share class (BRK.B, BF-B).
const TICKER_SHAPED = /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/;

// True when `q` is the first word of a company name ("APPLE", "TESLA"), which
// makes it a name search even though it is ticker-shaped.
const startsName = (row, q) => {
  const n = String(row.name || "").toUpperCase();
  return n.startsWith(q) && !/[A-Z0-9]/.test(n.charAt(q.length));
};

// `pending` is true while the Yahoo search has not answered for this text.
export function buildSuggestions({ value, parsed, poolList = [], watch = [], yahoo = [], pending = false }) {
  const q = String(value || "").trim().toUpperCase();
  if (parsed.kind === "navigate") {
    const r = ROUTES.find((x) => x.name === parsed.name);
    return r ? [fnItem(r, parsed.params, parsed.query)] : [];
  }
  if (parsed.kind === "command") return COMMAND_ITEMS.filter((c) => c.command === parsed.command);
  if (parsed.kind === "empty") return [...ROUTES.map((r) => fnItem(r)), ...COMMAND_ITEMS];

  const out = [];
  const seenSymbols = new Set();
  const pushSymbol = (item) => { if (!seenSymbols.has(item.symbol)) { seenSymbols.add(item.symbol); out.push(item); } };
  const bySym = new Map(poolList.map((x) => [x.symbol, x]));
  // Yahoo writes class shares with a dash (BRK-B); people type a dot.
  const sq = q.replace(/\./g, "-");

  // A ticker typed in full leads, so Enter on "MS" opens Morgan Stanley rather
  // than MSFT, which would otherwise come first as a watchlist or prefix hit.
  // Yahoo's results count too, for tickers outside the tracked list ("AA"),
  // though they arrive after the search debounce. Indices stay out, as they do
  // from the tracked list below.
  const exact = q.startsWith("^") ? null
    : bySym.get(sq) || yahoo.find((r) => r.symbol === sq) || (watch.includes(sq) ? { symbol: sq } : null);
  if (exact) pushSymbol(symItem("exact", exact));
  // Until Yahoo answers, a ticker-shaped word with no exact hit is taken as a
  // ticker, so Enter on "SOFI" opens SOFI instead of nothing, and "ARM" does
  // not open whichever company has "arm" in its name. A word that starts a
  // tracked company's name ("APPLE") is left to the name match.
  else if (pending && TICKER_SHAPED.test(q) && !poolList.some((row) => startsName(row, q))) {
    pushSymbol({ id: `exact:${sq}`, kind: "exact", label: sq, sub: "Open in Equities", symbol: sq, right: "" });
  }

  // Ticker matches rank above name matches (filterRows), so a name that merely
  // contains the text cannot take Enter from a ticker that starts with it.
  // Names match only at a word start: "ARM" is not Garmin or Pharma, and "MS"
  // is not Systems.
  for (const row of filterRows(watch.map((s) => bySym.get(s) || { symbol: s }), q, { wordStart: true })) {
    pushSymbol(symItem("watch", row));
  }
  let tracked = 0;
  for (const row of filterRows(poolList, q, { wordStart: true })) {
    if (tracked >= 6) break;
    if (row.symbol.startsWith("^") || seenSymbols.has(row.symbol)) continue;
    pushSymbol(symItem("tracked", row));
    tracked += 1;
  }
  let found = 0;
  for (const r of rankBySymbol(yahoo, sq)) {
    if (found >= 6) break;
    if (!r.symbol || seenSymbols.has(r.symbol)) continue;
    pushSymbol({ id: `search:${r.symbol}`, kind: "search", label: r.symbol, sub: r.name || "", symbol: r.symbol, right: [r.type, exchangeLabel(r.exchange)].filter(Boolean).join(" · ") });
    found += 1;
  }
  for (const r of ROUTES) {
    if (r.mnemonic.startsWith(q) || r.label.toUpperCase().includes(q) || r.title.toUpperCase().includes(q)) out.push(fnItem(r));
  }
  for (const c of COMMAND_ITEMS) if (c.label.startsWith(q)) out.push(c);
  return out;
}

export const GROUP_LABELS = { exact: "TICKER", function: "FUNCTIONS", watch: "WATCHLIST", tracked: "TRACKED", search: "SEARCH", command: "COMMANDS" };
