// Client-side copy of the proxy's ticker rule (server/index.js, TICKER_RE,
// which adds the /i flag because the server lowercases nothing). Keep the two
// in sync; the client uppercases before testing.
export const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

export function normalizeSymbol(s) {
  const t = String(s ?? "").trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}
