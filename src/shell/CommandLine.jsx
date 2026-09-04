import { useEffect, useMemo, useRef, useState } from "react";
import { parseCommand } from "./commandParser.js";
import { buildSuggestions, GROUP_LABELS } from "./suggestions.js";
import { registerCommandLine } from "./commandLine.js";
import { openHelp } from "./help.js";
import { useLayer } from "../ui/useLayer.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toast } from "../ui/toasts.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { useSearch } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { settings, setSetting } from "../stores/settings.js";
import { navigate, pathFor } from "../router/index.jsx";
import { Change } from "../ui/Change.jsx";
import { fmtNum } from "../lib/format.js";

const THEME_CYCLE = { dark: "light", light: "system", system: "dark" };

function runCommand(command) {
  if (command === "theme") {
    const next = THEME_CYCLE[settings.get().theme] || "dark";
    setSetting("theme", next);
    toast({ title: `THEME · ${next.toUpperCase()}` });
  } else if (command === "density") {
    const next = settings.get().density === "compact" ? "comfortable" : "compact";
    setSetting("density", next);
    toast({ title: `DENSITY · ${next.toUpperCase()}` });
  } else if (command === "help") {
    openHelp();
  }
}

export function CommandLine() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const pool = useQuotePool();
  const watch = useStore(watchlist, (s) => s.symbols);
  const quickLook = useQuickLook();

  const parsed = useMemo(() => parseCommand(value), [value]);
  const searchQuery = parsed.kind === "search" && parsed.query.length >= 2 ? parsed.query : "";
  const { results: yahoo, loading: searching } = useSearch(searchQuery, 400);
  const items = useMemo(
    () => buildSuggestions({ value, parsed, poolList: pool.equities, watch, yahoo }),
    [value, parsed, pool.equities, watch, yahoo]
  );

  useEffect(() => { setActive(0); }, [value]);

  useEffect(() => registerCommandLine((prefill) => {
    setValue(prefill);
    setOpen(true);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }), []);

  const reset = () => { setOpen(false); setValue(""); if (inputRef.current) inputRef.current.blur(); };
  useLayer(open, reset);

  const runItem = (item, shift) => {
    reset();
    if (item.kind === "function") navigate(pathFor(item.routeName, item.params, item.query));
    else if (item.kind === "command") runCommand(item.command);
    else if (shift) quickLook.open(item.symbol);
    else navigate(pathFor("equities", { symbol: item.symbol }));
  };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Escape") { e.preventDefault(); reset(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (parsed.kind === "navigate") { reset(); navigate(pathFor(parsed.name, parsed.params, parsed.query)); }
      else if (parsed.kind === "command") { reset(); runCommand(parsed.command); }
      else if (items[active]) runItem(items[active], e.shiftKey);
    }
  };

  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.kind === item.kind) last.items.push(item);
    else groups.push({ kind: item.kind, items: [item] });
  }
  let flat = -1;

  return (
    <div className={`pb-cmd${open ? " pb-cmd--open" : ""}`}>
      <input
        ref={inputRef}
        className="pb-cmd__input"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="FUNCTION OR SYMBOL"
        aria-label="Command line"
        role="combobox"
        aria-expanded={open}
        aria-controls="pb-cmd-list"
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `pb-cmd-opt-${active}` : undefined}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
      />
      <span className="pb-cmd__go" aria-hidden="true">GO</span>
      {open && (
        <div className="pb-cmd__pop" id="pb-cmd-list" role="listbox">
          {groups.length === 0 && (
            <div className="pb-cmd__group"><div className="pb-cmd__empty pb-muted">{searching ? "SEARCHING…" : "NO MATCH"}</div></div>
          )}
          {groups.map((g) => (
            <div key={g.kind} className="pb-cmd__group">
              <div className="pb-cmd__grouplbl">{GROUP_LABELS[g.kind]}{g.kind === "search" && searching ? " · SEARCHING…" : ""}</div>
              {g.items.map((item) => {
                flat += 1;
                const idx = flat;
                const on = idx === active;
                return (
                  <div
                    key={item.id}
                    id={`pb-cmd-opt-${idx}`}
                    role="option"
                    aria-selected={on}
                    className={`pb-cmd__opt${on ? " pb-cmd__opt--on" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); runItem(item, e.shiftKey); }}
                    onMouseEnter={() => setActive(idx)}
                  >
                    <span className="pb-cmd__optlbl">{item.label}</span>
                    <span className="pb-cmd__optsub pb-muted">{item.sub}</span>
                    <span className="pb-cmd__optright">
                      {item.price > 0 && <>{fmtNum(item.price)} <Change value={item.changePercent} /></>}
                      {!(item.price > 0) && item.right && <span className="pb-muted">{item.right}</span>}
                      <span className="pb-cmd__hint pb-muted">{item.kind === "function" || item.kind === "command" ? "GO" : "GO · ⇧ QUICK LOOK"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
