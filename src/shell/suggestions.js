import { ROUTES } from "../router/routes.js";

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
  price: row.price, changePercent: row.changePercent, right: row.exchange || "",
});

export function buildSuggestions({ value, parsed, poolList = [], watch = [], yahoo = [] }) {
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
  const hit = (row) => row.symbol.startsWith(q) || (row.name || "").toUpperCase().includes(q);

  for (const s of watch) {
    const row = bySym.get(s) || { symbol: s };
    if (hit(row)) pushSymbol(symItem("watch", row));
  }
  let tracked = 0;
  for (const row of poolList) {
    if (tracked >= 6) break;
    if (row.symbol.startsWith("^") || seenSymbols.has(row.symbol) || !hit(row)) continue;
    pushSymbol(symItem("tracked", row));
    tracked += 1;
  }
  let found = 0;
  for (const r of yahoo) {
    if (found >= 6) break;
    if (!r.symbol || seenSymbols.has(r.symbol)) continue;
    pushSymbol({ id: `search:${r.symbol}`, kind: "search", label: r.symbol, sub: r.name || "", symbol: r.symbol, right: [r.type, r.exchange].filter(Boolean).join(" · ") });
    found += 1;
  }
  for (const r of ROUTES) {
    if (r.mnemonic.startsWith(q) || r.label.toUpperCase().includes(q) || r.title.toUpperCase().includes(q)) out.push(fnItem(r));
  }
  for (const c of COMMAND_ITEMS) if (c.label.startsWith(q)) out.push(c);
  return out;
}

export const GROUP_LABELS = { function: "FUNCTIONS", watch: "WATCHLIST", tracked: "TRACKED", search: "SEARCH", command: "COMMANDS" };
