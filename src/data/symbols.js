export const POOL_CAP = 300; // the proxy's per-request hard cap
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/;

// Flatten any nesting of arrays and strings into a unique, validated,
// uppercase symbol list in first-seen order.
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
  return out.slice(0, POOL_CAP);
}
