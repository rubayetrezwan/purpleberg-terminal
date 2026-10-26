// Pure screener logic: derived columns, presets, and the filter predicate.
// No React; the screen owns state and the URL.
import { exchangeLabel } from "./exchange.js";

// Position in the 52-week range, 0 to 1, or null when the range is unusable.
export function pos52(row) {
  const lo = Number(row.week52Low);
  const hi = Number(row.week52High);
  const px = Number(row.price);
  if (!(lo > 0) || !(hi > lo) || !(px > 0)) return null;
  return Math.min(1, Math.max(0, (px - lo) / (hi - lo)));
}

// Fraction below the 52-week high (negative), or null.
export function offHigh(row) {
  const hi = Number(row.week52High);
  const px = Number(row.price);
  if (!(hi > 0) || !(px > 0)) return null;
  return px / hi - 1;
}

export const PRESETS = [
  { id: "dividend", label: "DIVIDEND", test: (r) => Number(r.dividendYield) >= 2 },
  { id: "value", label: "VALUE", test: (r) => Number(r.pe) > 0 && Number(r.pe) <= 15 },
  { id: "highbeta", label: "HIGH BETA", test: (r) => Number(r.beta) >= 1.5 },
  { id: "nearhigh", label: "NEAR 52W HI", test: (r) => Number(r.week52High) > 0 && Number(r.price) >= 0.95 * Number(r.week52High) },
  { id: "nearlow", label: "NEAR 52W LO", test: (r) => Number(r.week52Low) > 0 && Number(r.price) <= 1.1 * Number(r.week52Low) },
  { id: "megacap", label: "MEGA CAP", test: (r) => Number(r.marketCap) >= 500e9 },
];

export const FILTER_DEFAULTS = {
  q: "", exchange: "", sector: "", index: "", peMin: "", peMax: "", priceMin: "", priceMax: "",
  capMin: "", yieldMin: "", betaMin: "", betaMax: "", posMin: "", posMax: "",
};

// Index filter values. Rows carry `spx` and `ndx` flags from the universe;
// "other" is a tracked stock in neither index.
export const INDEX_FILTERS = [
  { value: "spx", label: "S&P 500", test: (r) => Boolean(r.spx) },
  { value: "ndx", label: "NASDAQ 100", test: (r) => Boolean(r.ndx) },
  { value: "other", label: "OTHER", test: (r) => !r.spx && !r.ndx },
];

// A bound that is not a finite number (peMin=abc from a hand-edited URL) is
// ignored like a blank one, rather than failing every row.
const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// A row passes when every provided bound holds. Blank fields are ignored.
// P/E bounds drop non-positive P/E so a "max 30" screen cannot include loss-makers,
// and price bounds drop a missing (0) price so "max 20" is not a list of blanks.
export function matchesFilters(row, filters = {}) {
  const f = { ...FILTER_DEFAULTS, ...filters };
  const q = String(f.q || "").trim().toUpperCase();
  if (q && !(row.symbol.includes(q) || String(row.name || "").toUpperCase().includes(q))) return false;
  // Grouped by the name a user knows: NMS, NGM and NCM are all NASDAQ. A raw
  // code from an old link or saved screen maps to the same name.
  if (f.exchange && exchangeLabel(row.exchange) !== exchangeLabel(f.exchange)) return false;
  if (f.sector && row.sector !== f.sector) return false;
  const ix = f.index ? INDEX_FILTERS.find((x) => x.value === f.index) : null;
  if (ix && !ix.test(row)) return false;
  const pe = Number(row.pe);
  const peMin = num(f.peMin);
  const peMax = num(f.peMax);
  if (peMin != null && !(pe > 0 && pe >= peMin)) return false;
  if (peMax != null && !(pe > 0 && pe <= peMax)) return false;
  const px = Number(row.price);
  const priceMin = num(f.priceMin);
  const priceMax = num(f.priceMax);
  if (priceMin != null && !(px > 0 && px >= priceMin)) return false;
  if (priceMax != null && !(px > 0 && px <= priceMax)) return false;
  const capMin = num(f.capMin);
  if (capMin != null && !(Number(row.marketCap) >= capMin * 1e9)) return false;
  const yieldMin = num(f.yieldMin);
  if (yieldMin != null && !(Number(row.dividendYield) >= yieldMin)) return false;
  const beta = nonZeroOrNull(row.beta);
  const betaMin = num(f.betaMin);
  const betaMax = num(f.betaMax);
  if (betaMin != null && !(beta != null && beta >= betaMin)) return false;
  if (betaMax != null && !(beta != null && beta <= betaMax)) return false;
  const pos = pos52(row);
  const posMin = num(f.posMin);
  const posMax = num(f.posMax);
  if (posMin != null && !(pos != null && pos * 100 >= posMin)) return false;
  if (posMax != null && !(pos != null && pos * 100 <= posMax)) return false;
  return true;
}

// How many filter fields hold a value. Drives the phone FILTERS count and
// decides whether there is anything worth saving.
export function activeFilterCount(filters = {}) {
  return Object.keys(FILTER_DEFAULTS).filter((k) => String(filters[k] ?? "").trim() !== "").length;
}

// Bounds that can never match, so an empty table can say why instead of a bare
// NO MATCH. Beta is the one field that may go below zero.
const BOUNDS = [
  { label: "P/E", min: "peMin", max: "peMax", floor: 0 },
  { label: "PRICE", min: "priceMin", max: "priceMax", floor: 0 },
  { label: "MKT CAP", min: "capMin", floor: 0 },
  { label: "DIV %", min: "yieldMin", floor: 0 },
  { label: "BETA", min: "betaMin", max: "betaMax" },
  { label: "52W POS", min: "posMin", max: "posMax", floor: 0, ceil: 100 },
];

// [{ keys, text }]: the offending field keys (to mark the inputs) and a terse
// reason ("P/E MIN > MAX").
export function filterProblems(filters = {}) {
  const out = [];
  for (const b of BOUNDS) {
    const lo = num(filters[b.min]);
    const hi = b.max ? num(filters[b.max]) : null;
    if (lo != null && hi != null && lo > hi) {
      out.push({ keys: [b.min, b.max], text: `${b.label} MIN > MAX` });
      continue;
    }
    if (b.floor != null && lo != null && lo < b.floor) out.push({ keys: [b.min], text: `${b.label} MIN < ${b.floor}` });
    if (b.floor != null && hi != null && hi < b.floor) out.push({ keys: [b.max], text: `${b.label} MAX < ${b.floor}` });
    if (b.ceil != null && lo != null && lo > b.ceil) out.push({ keys: [b.min], text: `${b.label} MIN > ${b.ceil}` });
  }
  return out;
}

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

// Only non-default fields go in the URL, so a clean screen has a clean link.
export function filtersToQuery(filters) {
  const out = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== "" && v != null && v !== FILTER_DEFAULTS[k]) out[k] = String(v);
  }
  return out;
}

export function filtersFromQuery(query = {}) {
  const out = { ...FILTER_DEFAULTS };
  for (const k of Object.keys(FILTER_DEFAULTS)) {
    if (query[k] != null && query[k] !== "") out[k] = String(query[k]);
  }
  return out;
}

// Sort value for a column the proxy fills with 0 when it has nothing (P/E,
// dividend, market cap, volume). Those cells print "—", and sortRows sinks
// null to the bottom in both directions, so an ascending P/E sort starts at the
// cheapest real P/E instead of a block of blanks.
export function positiveOrNull(v) {
  const n = Number(v);
  return n > 0 ? n : null;
}

// Beta can be negative (BP, an oil major, sits near -0.2 against the S&P), so
// only the proxy's placeholder 0 and junk count as missing.
export function nonZeroOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

// Column value helpers the screen shares with the sort comparator.
export const derived = {
  pos52: (row) => pos52(row),
  offHigh: (row) => offHigh(row),
};
