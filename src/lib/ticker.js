// Client-side copy of the proxy's ticker rule (server/index.js, TICKER_RE,
// which adds the /i flag because the server lowercases nothing). Keep the two
// in sync; the client uppercases before testing.
export const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

export function normalizeSymbol(s) {
  const t = String(s ?? "").trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

// A ticker as a person types it, in the form Yahoo quotes it under. Share
// classes are written BRK.B or BRK/B but Yahoo lists them as BRK-B, and asking
// for BRK.B fails. Only a single class letter after the separator is
// rewritten: a dot before a longer suffix is an exchange (000001.SS, RY.TO)
// and must stay a dot.
export function toYahooSymbol(s) {
  const t = String(s ?? "").trim().toUpperCase().replace(/^([A-Z]{1,5})[./]([A-C])$/, "$1-$2");
  return normalizeSymbol(t);
}
