// Pure helpers behind DataTable.

const isMissing = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base", numeric: true });
}

// Stable sort by one column. Missing values always sink to the bottom.
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
      return c !== 0 ? c * dir : x.i - y.i;
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

// "1".."9" -> 0..8, anything else -> -1.
export function digitIndex(key) {
  if (typeof key !== "string" || key.length !== 1) return -1;
  const n = key.charCodeAt(0) - 49;
  return n >= 0 && n <= 8 ? n : -1;
}
