import { useEffect, useMemo, useRef, useState } from "react";
import { sortRows, visibleWindow, digitIndex } from "./tableUtils.js";
import { Skeleton } from "./Skeleton.jsx";
import { EmptyState } from "./EmptyState.jsx";

function rowHeightPx() {
  if (typeof window === "undefined") return 24;
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-h"), 10);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

// columns: [{ key, label, align?: "left"|"right", width?, sortable?, sortValue?(row), render?(row, i) }]
// sort: { key, dir: "asc"|"desc" } | null
export function DataTable({
  columns, rows, rowKey, sort = null, onSort, selectedKey, onRowClick, onRowSpace,
  navigable = false, numbered = false, virtualize = false, height = 480,
  loading = false, empty = "NO DATA", skeletonRows = 8, label, className = "",
}) {
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const keyOf = (row, i) => (rowKey ? rowKey(row) : i);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);
  const rowH = rowHeightPx();
  const win = virtualize ? visibleWindow(scrollTop, rowH, sorted.length, height, 8) : { start: 0, end: sorted.length };
  const slice = sorted.slice(win.start, win.end);

  useEffect(() => {
    if (focusIdx >= sorted.length) setFocusIdx(sorted.length ? sorted.length - 1 : -1);
  }, [sorted.length, focusIdx]);

  // After a keyboard move the target row may only exist after re-render (virtualised).
  useEffect(() => {
    if (!navigable || focusIdx < 0 || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-row-index="${focusIdx}"]`);
    if (el && document.activeElement !== el && scrollRef.current.contains(document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  }, [focusIdx, win.start, navigable]);

  const ensureVisible = (idx) => {
    const s = scrollRef.current;
    if (!s) return;
    if (virtualize) {
      const top = idx * rowH;
      const bottom = top + rowH;
      if (top < s.scrollTop) s.scrollTop = top;
      else if (bottom > s.scrollTop + s.clientHeight) s.scrollTop = bottom - s.clientHeight;
      setScrollTop(s.scrollTop);
    } else {
      const el = s.querySelector(`[data-row-index="${idx}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  };

  const onKeyDown = (e) => {
    if (!navigable || !sorted.length) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const page = Math.max(1, Math.floor(height / rowH) - 1);
    let next = null;
    if (e.key === "ArrowDown") next = Math.min(sorted.length - 1, focusIdx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, focusIdx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sorted.length - 1;
    else if (e.key === "PageDown") next = Math.min(sorted.length - 1, focusIdx + page);
    else if (e.key === "PageUp") next = Math.max(0, focusIdx - page);
    else if (e.key === "Enter" && focusIdx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowClick) onRowClick(sorted[focusIdx], focusIdx);
      return;
    } else if (e.key === " " && focusIdx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowSpace) onRowSpace(sorted[focusIdx], focusIdx);
      return;
    } else {
      const d = digitIndex(e.key);
      if (d >= 0) {
        const first = virtualize ? Math.floor(scrollTop / rowH) : 0;
        const idx = first + d;
        if (idx < sorted.length) {
          e.preventDefault();
          e.stopPropagation();
          setFocusIdx(idx);
          if (onRowClick) onRowClick(sorted[idx], idx);
        }
      }
      return;
    }
    if (next != null) {
      e.preventDefault();
      e.stopPropagation();
      setFocusIdx(next);
      ensureVisible(next);
    }
  };

  const colCount = columns.length + (numbered ? 1 : 0);
  const headerCell = (c) => {
    const active = sort && sort.key === c.key;
    const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    return (
      <th key={c.key} className={`pb-dt__th pb-dt__th--${c.align || "right"}`} style={c.width ? { width: c.width } : undefined} aria-sort={c.sortable ? ariaSort : undefined}>
        {c.sortable ? (
          <button
            type="button"
            className="pb-reset pb-dt__sort"
            onClick={() => onSort && onSort({ key: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
          >
            {c.label}
            {active && <span className="pb-dt__caret" aria-hidden="true">{sort.dir === "asc" ? "▲" : "▼"}</span>}
          </button>
        ) : c.label}
      </th>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={`pb-dt${virtualize ? " pb-dt--virtual" : ""}${navigable ? " pb-dt--nav" : ""}${className ? " " + className : ""}`}
      style={virtualize ? { height, overflow: "auto" } : undefined}
      onScroll={virtualize ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
    >
      <table className="pb-dt__table">
        <thead>
          <tr>
            {numbered && <th className="pb-dt__th pb-dt__num" aria-label="Row number" />}
            {columns.map(headerCell)}
          </tr>
        </thead>
        <tbody>
          {loading && !sorted.length ? (
            <tr><td colSpan={colCount}><Skeleton rows={skeletonRows} /></td></tr>
          ) : !sorted.length ? (
            <tr><td colSpan={colCount}><EmptyState>{empty}</EmptyState></td></tr>
          ) : (
            <>
              {virtualize && win.start > 0 && (
                <tr aria-hidden="true" style={{ height: win.start * rowH }}><td colSpan={colCount} /></tr>
              )}
              {slice.map((row, j) => {
                const i = win.start + j;
                const key = keyOf(row, i);
                const selected = selectedKey != null && key === selectedKey;
                const tabIndex = navigable ? (i === (focusIdx < 0 ? 0 : focusIdx) ? 0 : -1) : undefined;
                return (
                  <tr
                    key={key}
                    data-row-index={i}
                    tabIndex={tabIndex}
                    className={`pb-dt__tr${selected ? " pb-dt__tr--selected" : ""}${onRowClick ? " pb-dt__tr--click" : ""}`}
                    aria-selected={selected || undefined}
                    onClick={onRowClick ? () => { setFocusIdx(i); onRowClick(row, i); } : undefined}
                    onFocus={navigable ? () => setFocusIdx(i) : undefined}
                  >
                    {numbered && <td className="pb-dt__td pb-dt__num">{i + 1})</td>}
                    {columns.map((c) => (
                      <td key={c.key} className={`pb-dt__td pb-dt__td--${c.align || "right"}`}>
                        {c.render ? c.render(row, i) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {virtualize && win.end < sorted.length && (
                <tr aria-hidden="true" style={{ height: (sorted.length - win.end) * rowH }}><td colSpan={colCount} /></tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
