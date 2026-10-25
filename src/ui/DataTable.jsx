import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDensity } from "../theme/useResolvedTheme.js";
import { sortRows, visibleWindow, digitIndex, digitRow, maxScrollTop, revealRow } from "./tableUtils.js";
import { GridContext } from "./gridContext.js";
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
// `rowKey(row)` using strict equality, so keep both the same type. Row numbers
// are the absolute rank, and the digit keys 1-9 select the row with that
// number, scrolling it into view.
export function DataTable({
  columns, rows, rowKey, sort = null, onSort, selectedKey, onRowClick, onRowSpace,
  navigable = false, numbered = false, virtualize = false, height = 480,
  loading = false, empty = "NO DATA", skeletonRows = 8, label, className = "",
}) {
  const keyboard = navigable || Boolean(onRowClick);
  const density = useDensity();
  const rowH = useMemo(() => rowHeightPx(), [density]);
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  // rowKey receives the index too, so a caller whose rows have no natural
  // unique field (an event feed, say) can fall back to position.
  const keyOf = (row, i) => (rowKey ? rowKey(row, i) : i);
  // The cursor is held by row identity, not by position. A live poll re-sorts
  // these tables under the keyboard, and an index would leave the cursor on
  // whatever row moved into that slot — so Enter opened, and Space starred, an
  // instrument the user was not looking at.
  const [focusKey, setFocusKey] = useState(null);
  // The viewport height is read from the element rather than taken from the
  // `height` prop, because a horizontal scrollbar takes its share of that box.
  const [scroll, setScroll] = useState({ top: 0, viewportH: null });
  const syncScroll = (el) => {
    const next = { top: el.scrollTop, viewportH: el.clientHeight };
    setScroll((s) => (s.top === next.top && s.viewportH === next.viewportH ? s : next));
  };
  const scrollRef = useRef(null);
  // A filling table changes height with the window (and the iPhone toolbar),
  // so the visible window is recomputed from the measured box.
  useEffect(() => {
    if (!virtualize || !scrollRef.current || typeof ResizeObserver === "undefined") return undefined;
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => syncScroll(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualize]); // eslint-disable-line react-hooks/exhaustive-deps
  const movedByKey = useRef(false);
  const lastIdx = useRef(-1);
  // True while the keyboard is in this table. Deleting the focused row
  // unmounts it and drops focus to <body>, and only a table that had focus
  // may take it back — otherwise a re-render would steal it on mount.
  const hadFocus = useRef(false);

  const foundIdx = useMemo(() => {
    if (focusKey == null) return -1;
    return sorted.findIndex((row, i) => keyOf(row, i) === focusKey);
  }, [sorted, focusKey, rowKey]);
  // A row that is gone (deleted, or filtered out) leaves the cursor where it
  // was, clamped, so the keyboard lands on the neighbour rather than nowhere.
  const focusIdx = foundIdx >= 0
    ? foundIdx
    : (focusKey == null ? -1 : Math.min(lastIdx.current, sorted.length - 1));
  useEffect(() => { lastIdx.current = focusIdx; }, [focusIdx]);
  const focusRowAt = (i) => setFocusKey(i >= 0 && i < sorted.length ? keyOf(sorted[i], i) : null);

  // height="fill" takes whatever height the parent column gives (it must be a
  // flex column); the real size is measured below, 480 is only the first guess.
  const fill = height === "fill";
  const viewportH = scroll.viewportH || (fill ? 480 : height);
  const top = virtualize ? Math.min(scroll.top, maxScrollTop(sorted.length, rowH, viewportH)) : 0;
  const win = virtualize ? visibleWindow(top, rowH, sorted.length, viewportH, 8) : { start: 0, end: sorted.length };
  const slice = sorted.slice(win.start, win.end);
  // The one row that carries tabIndex 0 must be rendered, or Tab skips the table.
  const rovingIdx = focusIdx >= win.start && focusIdx < win.end ? focusIdx : win.start;

  // After a keyboard move the target row may only exist after re-render
  // (virtualised) and the previously focused row may have unmounted, which
  // drops focus to <body>. Never steal focus from an in-cell control.
  useEffect(() => {
    if (!keyboard || focusIdx < 0 || !scrollRef.current) return;
    const active = document.activeElement;
    const inside = scrollRef.current.contains(active);
    const onControl = inside && active !== scrollRef.current && active.tagName !== "TR";
    if (onControl) return;
    const orphaned = hadFocus.current && (active == null || active === document.body);
    if (!movedByKey.current && !inside && !orphaned) return;
    const el = scrollRef.current.querySelector(`[data-row-index="${focusIdx}"]`);
    if (el && active !== el) el.focus({ preventScroll: true });
    movedByKey.current = false;
  }, [focusIdx, win.start, keyboard, sorted.length]);

  const ensureVisible = (idx) => {
    const s = scrollRef.current;
    if (!s) return;
    if (virtualize) {
      s.scrollTop = revealRow(idx, rowH, s.scrollTop, s.clientHeight);
      syncScroll(s);
    } else {
      const el = s.querySelector(`[data-row-index="${idx}"]`);
      if (el) el.scrollIntoView({ block: "nearest" }); // scroll-margin-top clears the sticky header
    }
  };

  const onKeyDown = (e) => {
    if (!keyboard || !sorted.length) return;
    if (e.target.closest(INTERACTIVE)) return; // in-cell controls own their own keys
    const pageH = scrollRef.current ? scrollRef.current.clientHeight : viewportH;
    const page = Math.max(1, Math.floor(pageH / rowH) - 1);
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
    } else if (e.key === " " && current >= 0 && onRowSpace) {
      // Only claim Space where something is listening; otherwise it stays the
      // browser's page-down for a focused table.
      e.preventDefault();
      e.stopPropagation();
      onRowSpace(sorted[current], current);
      return;
    } else {
      if (digitIndex(e.key) < 0) return;
      e.preventDefault();
      e.stopPropagation(); // digits belong to the list, never to the command line
      const idx = digitRow(e.key, sorted.length);
      if (idx >= 0) {
        movedByKey.current = true;
        focusRowAt(idx);
        ensureVisible(idx);
        if (onRowClick) onRowClick(sorted[idx], idx);
      }
      return;
    }
    if (next != null) {
      e.preventDefault();
      e.stopPropagation();
      movedByKey.current = true;
      focusRowAt(next);
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
      style={virtualize ? (fill ? { flex: "1 1 0", minHeight: 0, overflow: "auto" } : { height, overflow: "auto" }) : undefined}
      onScroll={virtualize ? (e) => syncScroll(e.currentTarget) : undefined}
      onKeyDown={onKeyDown}
      onBlur={keyboard ? (e) => {
        const to = e.relatedTarget;
        // A null relatedTarget is the unmount case (or a click on the page
        // chrome), which the effect above handles; anything else means focus
        // deliberately went elsewhere.
        if (to && scrollRef.current && !scrollRef.current.contains(to)) hadFocus.current = false;
      } : undefined}
      tabIndex={virtualize && !keyboard ? 0 : undefined}
    >
      <GridContext.Provider value={keyboard}>
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
                // The rank, always. A number relative to the scroll position
                // made the list restart at "1)" part-way down.
                const number = i + 1;
                return (
                  <tr
                    key={key}
                    data-row-index={i}
                    tabIndex={tabIndex}
                    aria-rowindex={virtualize ? i + 2 : undefined}
                    className={`pb-dt__tr${selected ? " pb-dt__tr--selected" : ""}${onRowClick ? " pb-dt__tr--click" : ""}`}
                    aria-selected={keyboard ? selected : undefined}
                    onClick={onRowClick ? () => { focusRowAt(i); onRowClick(row, i); } : undefined}
                    onFocus={keyboard ? (e) => { if (e.target === e.currentTarget) { hadFocus.current = true; focusRowAt(i); } } : undefined}
                  >
                    {numbered && <td className="pb-dt__td pb-dt__num">{`${number})`}</td>}
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
      </GridContext.Provider>
    </div>
  );
}
