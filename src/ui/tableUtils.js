// Pure helpers behind DataTable.

const isMissing = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

// Stable sort by one column. Missing values always sink to the bottom. Never
// mutates `rows`; returns it unchanged when there is nothing to sort by.
export function sortRows(rows, columns, sort) {
  if (!sort || !sort.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  const value = col.sortValue || ((row) => row[col.key]);
  return rows
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((x, y) => {
      const xm = isMissing(x.v);
      const ym = isMissing(y.v);
      if (xm || ym) return xm && ym ? x.i - y.i : xm ? 1 : -1;
      const c = compareValues(x.v, y.v);
      return c ? c * dir : x.i - y.i; // NaN and 0 both fall through to the stable tiebreak
    })
    .map((x) => x.row);
}

// Row window for fixed-height virtualisation.
export function visibleWindow(scrollTop, rowH, total, viewportH, overscan = 8) {
  const first = Math.floor(scrollTop / rowH);
  const last = Math.ceil((scrollTop + viewportH) / rowH);
  const start = Math.min(total, Math.max(0, first - overscan));
  const end = Math.min(total, last + overscan);
  return { start, end: Math.max(start, end) };
}

// Virtual-table geometry. The sticky header is a row of its own inside the
// scrollport, so row i spans (i + 1) * rowH to (i + 2) * rowH of the content
// and the content is one row taller than the body.

// Largest scrollTop a virtual table can reach.
export function maxScrollTop(total, rowH, viewportH) {
  return Math.max(0, (total + 1) * rowH - viewportH);
}

// The scrollTop that shows row `idx` in full below the header, moving as
// little as possible; the current one if the row is already in view.
export function revealRow(idx, rowH, scrollTop, viewportH) {
  const top = (idx + 1) * rowH;
  const bottom = top + rowH;
  if (top - rowH < scrollTop) return Math.max(0, top - rowH);
  if (bottom > scrollTop + viewportH) return bottom - viewportH;
  return scrollTop;
}

// The first row a reader actually sees below the sticky header, which is what
// "1)" and the 1 key refer to. A row more than half hidden under the header
// does not count.
export function firstVisibleRow(scrollTop, rowH, total) {
  if (!total) return 0;
  return Math.min(Math.round(Math.max(0, scrollTop) / rowH), total - 1);
}

// "1".."9" -> 0..8, anything else -> -1.
export function digitIndex(key) {
  if (typeof key !== "string" || key.length !== 1) return -1;
  const n = key.charCodeAt(0) - 49;
  return n >= 0 && n <= 8 ? n : -1;
}
