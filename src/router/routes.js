import { buildPath } from "./match.js";

// The screen table. `param` names the optional path parameter a mnemonic can
// carry from the command line ("DES AAPL" -> /equities/AAPL).
export const ROUTES = [
  { name: "dashboard", path: "/", mnemonic: "WEI", label: "Dashboard", title: "World equity indices" },
  { name: "equities", path: "/equities/:symbol?", mnemonic: "DES", label: "Equities", title: "Equity analysis", param: "symbol" },
  { name: "screener", path: "/screener", mnemonic: "EQS", label: "Screener", title: "Equity screener" },
  { name: "compare", path: "/compare", mnemonic: "COMP", label: "Compare", title: "Compare two equities" },
  { name: "fx", path: "/fx/:pair?", mnemonic: "WFX", label: "FX", title: "Foreign exchange", param: "pair" },
  { name: "rates", path: "/rates", mnemonic: "YAS", label: "Rates & Macro", title: "Treasury curve and macro calendar" },
  { name: "commodities", path: "/commodities/:symbol?", mnemonic: "CMDT", label: "Commodities", title: "Commodity futures", param: "symbol" },
  { name: "crypto", path: "/crypto/:id?", mnemonic: "CRYP", label: "Crypto", title: "Top 20 cryptocurrencies", param: "id" },
  { name: "ipos", path: "/ipos", mnemonic: "IPO", label: "IPOs", title: "IPO center" },
  { name: "portfolio", path: "/portfolio", mnemonic: "PORT", label: "Portfolio", title: "Portfolio manager" },
  { name: "news", path: "/news", mnemonic: "TOP", label: "News", title: "Market news" },
  { name: "settings", path: "/settings", mnemonic: "SET", label: "Settings", title: "Settings" },
];

// Old mnemonics that still resolve somewhere sensible.
export const ALIASES = {
  ECO: { name: "rates", query: { tab: "calendar" } },
  MARS: { name: "portfolio", query: { tab: "risk" } },
};

export const MOBILE_TAB_NAMES = ["dashboard", "equities", "portfolio", "news"];

const byName = new Map(ROUTES.map((r) => [r.name, r]));
const byMnemonic = new Map(ROUTES.map((r) => [r.mnemonic, r]));

export function routeByName(name) {
  return byName.get(name) || null;
}

export function routeByMnemonic(m) {
  return byMnemonic.get(String(m || "").toUpperCase()) || null;
}

export function isMnemonic(m) {
  const u = String(m || "").toUpperCase();
  return byMnemonic.has(u) || Object.prototype.hasOwnProperty.call(ALIASES, u);
}

export function pathFor(name, params = {}, query = {}) {
  const r = routeByName(name);
  if (!r) throw new Error(`unknown route ${name}`);
  return buildPath(r.path, params, query);
}
