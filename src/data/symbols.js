import { TICKER_RE } from "../lib/ticker.js";

// The proxy's per-request hard cap (MAX_QUOTE_SYMBOLS in server/index.js).
// The universe is about 700 symbols; the rest is headroom for the user's own.
export const POOL_CAP = 1000;

// Symbols the shell always needs: ^GSPC drives the session clock's market state.
export const POOL_FIXED = ["^GSPC"];

let lastWarnedDrop = -1;

// Flatten any nesting of arrays and strings into a unique, validated,
// uppercase symbol list in first-seen order. Callers put user-owned symbols
// before the static tracked list so the cap never drops the user's own data.
export function dedupeSymbols(lists) {
  const out = [];
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const s = String(v).trim().toUpperCase();
    if (!TICKER_RE.test(s) || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  walk(lists);
  if (out.length > POOL_CAP) {
    const dropped = out.length - POOL_CAP;
    if (dropped !== lastWarnedDrop) {
      lastWarnedDrop = dropped;
      console.warn(`[quotes] symbol pool capped at ${POOL_CAP}; ${dropped} symbols dropped`);
    }
    return out.slice(0, POOL_CAP);
  }
  return out;
}
