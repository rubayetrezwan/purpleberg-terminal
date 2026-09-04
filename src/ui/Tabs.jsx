import { useRef } from "react";

// tabs: string[] or [{ value, label }]. Left/Right (and Home/End) move and
// activate; only the active tab is in the Tab order.
export function Tabs({ tabs = [], active, onChange, label, className = "" }) {
  const listRef = useRef(null);
  const items = tabs.map((t) => (typeof t === "string" ? { value: t, label: t } : t));
  const activeIdx = Math.max(0, items.findIndex((t) => t.value === active));
  const move = (idx) => {
    const t = items[idx];
    if (!t) return;
    onChange(t.value);
    const el = listRef.current && listRef.current.children[idx];
    if (el) el.focus();
  };
  const onKeyDown = (e) => {
    if (!items.length) return;
    if (e.key === "ArrowRight") { e.preventDefault(); move((activeIdx + 1) % items.length); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move((activeIdx - 1 + items.length) % items.length); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(items.length - 1); }
  };
  return (
    <div ref={listRef} className={`pb-tabs${className ? " " + className : ""}`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((tab, i) => {
        const on = i === activeIdx;
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={`pb-tabs__tab${on ? " pb-tabs__tab--on" : ""}`} onClick={() => onChange(tab.value)}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
