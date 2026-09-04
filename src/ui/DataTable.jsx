import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDensity } from "../theme/useResolvedTheme.js";
import { sortRows, visibleWindow, digitIndex } from "./tableUtils.js";
import { Skeleton } from "./Skeleton.jsx";
import { EmptyState } from "./EmptyState.jsx";

const INTERACTIVE = "input,select,textarea,button,a,[contenteditable]";

function rowHeightPx() {
  if (typeof window === "undefined") return 24;
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-h"), 10);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

// columns: [{ key, label, align?: "left"|"right", width?, sortable?, sortValue?(row), render?(row, i) }]
// sort: { key, dir: "asc"|"desc" } | null
// Rows are keyboard-navigable whenever `navigable` or `onRowClick` is set, so
// a clickable row always has a keyboard path. `selectedKey` is compared with
// `rowKey(row)` using strict equality, so keep both the same type. With
// `virtualize`, the row numbers and the digit keys are both relative to the
// first visible row, so "3)" and the 3 key always agree.
export function DataTable({
  columns, rows, rowKey, sort = null, onSort, selectedKey, onRowClick, onRowSpace,
  navigable = false, numbered = false, virtualize = false, height = 480,
  loading = false, empty = "NO DATA", skeletonRows = 8, label, className = "",
}) {
  const keyboard = navigable || Boolean(onRowClick);
  const density = useDensity();
  const rowH = useMemo(() => rowHeightPx(), [density]);
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const keyOf = (row, i) => (rowKey ? rowKey(row) : i);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);
  const movedByKey = useRef(false);

  const maxScroll = Math.max(0, sorted.length * rowH - height);
  const top = virtualize ? Math.min(scrollTop, maxScroll) : 0;
  const win = virtualize ? visibleWindow(top, rowH, sorted.length, height, 8) : { start: 0, end: sorted.length };
  const slice = sorted.slice(win.start, win.end);
  const firstVisible = virtualize ? Math.min(Math.floor(top / rowH), Math.max(0, sorted.length - 1)) : 0;
  // The one row that carries tabIndex 0 must be rendered, or Tab skips the table.
  const rovingIdx = focusIdx >= win.start && focusIdx < win.end ? focusIdx : win.start;

  useEffect(() => {
    if (focusIdx >= sorted.length) setFocusIdx(sorted.length ? sorted.length - 1 : -1);
  }, [sorted.length, focusIdx]);

  // After a keyboard move the target row may only exist after re-render
  // (virtualised) and the previously focused row may have unmounted, which
  // drops focus to <body>. Never steal focus from an in-cell control.
  useEffect(() => {
    if (!keyboard || focusIdx < 0 || !scrollRef.current) return;
    const active = document.activeElement;
    const inside = scrollRef.current.contains(active);
    const onControl = inside && active !== scrollRef.current && active.tagName !== "TR";
    if (onControl) return;
    if (!movedByKey.current && !inside) return;
    const el = scrollRef.current.querySelector(`[data-row-index="${focusIdx}"]`);
    if (el && active !== el) el.focus({ preventScroll: true });
    movedByKey.current = false;
  }, [focusIdx, win.start, keyboard]);

  const ensureVisible = (idx) => {
    const s = scrollRef.current;
    if (!s) return;
    if (virtualize) {
      const rowTop = idx * rowH;
      const rowBottom = rowTop + rowH;
      const headerH = rowH; // the sticky header covers the top of the scrollport
      if (rowTop - headerH < s.scrollTop) s.scrollTop = Math.max(0, rowTop - headerH);
      else if (rowBottom > s.scrollTop + s.clientHeight) s.scrollTop = rowBottom - s.clientHeight;
      setScrollTop(s.scrollTop);
    } else {
      const el = s.querySelector(`[data-row-index="${idx}"]`);
      if (el) el.scrollIntoView({ block: "nearest" }); // scroll-margin-top clears the sticky header
    }
  };

  const onKeyDown = (e) => {
    if (!keyboard || !sorted.length) return;
    if (e.target.closest(INTERACTIVE)) return; // in-cell controls own their own keys
    const viewportH = virtualize ? height : (scrollRef.current ? scrollRef.current.clientHeight : height);
    const page = Math.max(1, Math.floor(viewportH / rowH) - 1);
    const current = focusIdx < 0 ? -1 : focusIdx;
    let next = null;
    if (e.key === "ArrowDown") next = Math.min(sorted.length - 1, current + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, current - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sorted.length - 1;
    else if (e.key === "PageDown") next = Math.min(sorted.length - 1, current + page);
    else if (e.key === "PageUp") next = Math.max(0, current - page);
    else if (e.key === "Enter" && current >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowClick) onRowClick(sorted[current], current);
      return;
    } else if (e.key === " " && current >= 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onRowSpace) onRowSpace(sorted[current], current);
      return;
    } else {
      const d = digitIndex(e.key);
      if (d < 0) return;
      e.preventDefault();
      e.stopPropagation(); // digits belong to the list, never to the command line
      const idx = firstVisible + d;
      if (idx < sorted.length) {
        movedByKey.current = true;
        setFocusIdx(idx);
        if (onRowClick) onRowClick(sorted[idx], idx);
      }
      return;
    }
    if (next != null) {
      e.preventDefault();
      e.stopPropagation();
      movedByKey.current = true;
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
            {active && (sort.dir === "asc"
              ? <ChevronUp size={12} strokeWidth={1.5} aria-hidden="true" />
              : <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />)}
          </button>
        ) : c.label}
      </th>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={`pb-dt${virtualize ? " pb-dt--virtual" : ""}${keyboard ? " pb-dt--nav" : ""}${className ? " " + className : ""}`}
      style={virtualize ? { height, overflow: "auto" } : undefined}
      onScroll={virtualize ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      onKeyDown={onKeyDown}
      tabIndex={virtualize && !keyboard ? 0 : undefined}
    >
      <table
        className="pb-dt__table"
        role={keyboard ? "grid" : undefined}
        aria-label={label}
        aria-rowcount={virtualize ? sorted.length + 1 : undefined}
        aria-busy={loading || undefined}
      >
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
            <tr><td colSpan={colCount}>{typeof empty === "string" ? <EmptyState>{empty}</EmptyState> : empty}</td></tr>
          ) : (
            <>
              {virtualize && win.start > 0 && (
                <tr aria-hidden="true" style={{ height: win.start * rowH }}><td colSpan={colCount} /></tr>
              )}
              {slice.map((row, j) => {
                const i = win.start + j;
                const key = keyOf(row, i);
                const selected = selectedKey != null && key === selectedKey;
                const tabIndex = keyboard ? (i === rovingIdx ? 0 : -1) : undefined;
                const number = virtualize ? i - firstVisible + 1 : i + 1;
                return (
                  <tr
                    key={key}
                    data-row-index={i}
                    tabIndex={tabIndex}
                    aria-rowindex={virtualize ? i + 2 : undefined}
                    className={`pb-dt__tr${selected ? " pb-dt__tr--selected" : ""}${onRowClick ? " pb-dt__tr--click" : ""}`}
                    aria-selected={keyboard ? selected : undefined}
                    onClick={onRowClick ? () => { setFocusIdx(i); onRowClick(row, i); } : undefined}
                    onFocus={keyboard ? (e) => { if (e.target === e.currentTarget) setFocusIdx(i); } : undefined}
                  >
                    {numbered && <td className="pb-dt__td pb-dt__num">{number > 0 ? `${number})` : ""}</td>}
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
