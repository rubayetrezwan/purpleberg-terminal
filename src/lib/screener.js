// Pure screener logic: derived columns, presets, and the filter predicate.
// No React; the screen owns state and the URL.

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
  q: "", exchange: "", peMin: "", peMax: "", priceMin: "", priceMax: "",
  capMin: "", yieldMin: "", betaMin: "", betaMax: "", posMin: "", posMax: "",
};

const num = (v) => (v === "" || v == null ? null : Number(v));

// A row passes when every provided bound holds. Blank fields are ignored.
// P/E bounds drop non-positive P/E so a "max 30" screen cannot include loss-makers.
export function matchesFilters(row, filters = {}) {
  const f = { ...FILTER_DEFAULTS, ...filters };
  const q = String(f.q || "").trim().toUpperCase();
  if (q && !(row.symbol.includes(q) || String(row.name || "").toUpperCase().includes(q))) return false;
  if (f.exchange && row.exchange !== f.exchange) return false;
  const pe = Number(row.pe);
  const peMin = num(f.peMin);
  const peMax = num(f.peMax);
  if (peMin != null && !(pe > 0 && pe >= peMin)) return false;
  if (peMax != null && !(pe > 0 && pe <= peMax)) return false;
  const px = Number(row.price);
  const priceMin = num(f.priceMin);
  const priceMax = num(f.priceMax);
  if (priceMin != null && !(px >= priceMin)) return false;
  if (priceMax != null && !(px <= priceMax)) return false;
  const capMin = num(f.capMin);
  if (capMin != null && !(Number(row.marketCap) >= capMin * 1e9)) return false;
  const yieldMin = num(f.yieldMin);
  if (yieldMin != null && !(Number(row.dividendYield) >= yieldMin)) return false;
  const beta = Number(row.beta);
  const betaMin = num(f.betaMin);
  const betaMax = num(f.betaMax);
  if (betaMin != null && !(beta > 0 && beta >= betaMin)) return false;
  if (betaMax != null && !(beta > 0 && beta <= betaMax)) return false;
  const pos = pos52(row);
  const posMin = num(f.posMin);
  const posMax = num(f.posMax);
  if (posMin != null && !(pos != null && pos * 100 >= posMin)) return false;
  if (posMax != null && !(pos != null && pos * 100 <= posMax)) return false;
  return true;
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

// Column value helpers the screen shares with the sort comparator.
export const derived = {
  pos52: (row) => pos52(row),
  offHigh: (row) => offHigh(row),
};
