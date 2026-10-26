import { ROUTES, ALIASES } from "../router/routes.js";

// Grammar (input uppercased, whitespace-split):
//   "<MNEMONIC> [ARG]"  -> navigate, ARG fills the route's param when it has one
//   "<ARG> <MNEMONIC>"  -> same, Bloomberg order
//   "THEME" | "DENSITY" | "HELP" -> command
//   anything else       -> search
const BY_MNEMONIC = new Map(ROUTES.map((r) => [r.mnemonic, r]));
// "?" is the shortcut-sheet key everywhere else, so typed here it means HELP.
export const COMMANDS = { THEME: "theme", DENSITY: "density", HELP: "help", "?": "help" };

// The FX and commodity headers show Yahoo's symbol ("USDJPY=X", "GC=F"), so
// people type it back; the screens add the suffix themselves, so it comes off
// here. Crypto keeps what was typed, lowercased: the screen matches it
// against CoinGecko ids, tickers and names alike ("bitcoin", "eth").
export function normaliseArg(routeName, arg) {
  if (routeName === "fx") {
    const letters = arg.replace(/=X$/i, "").replace(/[^A-Z]/gi, "");
    return letters.length === 6 ? letters.toUpperCase() : arg;
  }
  if (routeName === "commodities") return arg.replace(/=F$/i, "");
  if (routeName === "crypto") return arg.toLowerCase();
  return arg;
}

function route(mnemonic, rest) {
  const alias = ALIASES[mnemonic];
  if (alias) return { kind: "navigate", name: alias.name, params: {}, query: alias.query || {} };
  const r = BY_MNEMONIC.get(mnemonic);
  const arg = rest[0];
  const params = r.param && arg ? { [r.param]: normaliseArg(r.name, arg) } : {};
  return { kind: "navigate", name: r.name, params, query: {} };
}

const known = (t) => BY_MNEMONIC.has(t) || Object.prototype.hasOwnProperty.call(ALIASES, t);

export function parseCommand(input) {
  const tokens = String(input || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { kind: "empty" };
  if (tokens.length === 1 && COMMANDS[tokens[0]]) return { kind: "command", command: COMMANDS[tokens[0]] };
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (known(first)) return route(first, tokens.slice(1));
  if (tokens.length > 1 && known(last)) return route(last, tokens.slice(0, -1));
  return { kind: "search", query: tokens.join(" ") };
}
