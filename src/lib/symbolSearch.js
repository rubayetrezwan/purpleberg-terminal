import { toYahooSymbol } from "./ticker.js";

// Filtering a ~700-row security list by what the user typed. A ticker match
// beats a name match, so "MS" puts Morgan Stanley and MSFT ahead of every
// company with "ms" somewhere in its name. Ties keep the list's own order,
// which for the universe is market cap.
//
// Users type class shares the way they are written elsewhere (BRK.B); Yahoo
// writes them BRK-B. Only a share-class dot is read as a dash: an exchange
// suffix keeps its dot (000001.SS, RY.TO), and a half-typed "BRK." still
// finds BRK-B.
//
// `wordStart: true` matches names only where a word starts, so "ARM" finds
// Arm Holdings but not Garmin or "Pharmaceuticals". The command line wants
// that; a screen's own filter box keeps the looser default.
export function filterRows(rows, text, { wordStart = false } = {}) {
  const q = String(text ?? "").trim().toUpperCase();
  if (!q) return rows;
  const sq = q.replace(/^([A-Z]{1,5})[./]([A-C]?)$/, "$1-$2");
  const atWord = wordStart
    ? new RegExp(`(^|[^A-Z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    : null;
  const scored = [];
  rows.forEach((r, i) => {
    const sym = String(r.symbol || "");
    const name = String(r.name || "").toUpperCase();
    const rank = sym === sq ? 0
      : sym.startsWith(sq) ? 1
      : sym.includes(sq) ? 2
      : (atWord ? atWord.test(name) : name.includes(q)) ? 3
      : -1;
    if (rank >= 0) scored.push({ r, rank, i });
  });
  scored.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return scored.map((s) => s.r);
}

// What Enter in the filter opens: the best match in the (already ranked)
// rows, or, when nothing in the list matches, the text itself if it reads as
// a ticker, so any symbol Yahoo knows is one keystroke away.
export function pickFromFilter(rankedRows, text) {
  const q = String(text ?? "").trim();
  if (!q) return null;
  if (rankedRows.length) return rankedRows[0].symbol;
  return toYahooSymbol(q);
}
