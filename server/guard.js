// Pure helpers that limit how much upstream work one client can cause and what
// reaches the browser from upstream data. Kept out of index.js so node:test can
// load them (index.js starts listening on import).

// Only absolute http(s) URLs survive. Anything else (javascript:, data:,
// vbscript:, relative or malformed) becomes "", which the client treats as
// "no link". React 18 renders a javascript: href as-is, so a hostile value from
// an upstream feed would otherwise run script on this origin when clicked.
export function safeHttpUrl(value) {
  if (typeof value !== "string" || !value) return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return "";
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
}

// Split a quote request into the symbols the app itself tracks (the universe
// and the fixed index, FX, commodity, bond and IPO lists) and the rest. Known
// symbols are shared by every client's poll, so the per-symbol cache absorbs
// them; an unknown symbol is a fresh upstream lookup each time. Capping the
// unknown ones per request stops one call from making Yahoo look up hundreds
// of made-up tickers, which risks the server's IP being throttled for everyone.
// Order is kept, and known symbols are never dropped.
export function limitUnknownSymbols(symbols, known, maxUnknown) {
  const out = [];
  let unknown = 0;
  for (const s of symbols) {
    if (known.has(s)) out.push(s);
    else if (unknown < maxUnknown) {
      unknown += 1;
      out.push(s);
    }
  }
  return { symbols: out, unknown };
}
