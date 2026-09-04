import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { fmt, fmtK, fmtNum } from "../lib/format.js";
import {
  PRESETS, presetById, matchesFilters, pos52, offHigh,
  FILTER_DEFAULTS, filtersToQuery, filtersFromQuery,
} from "../lib/screener.js";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useQuotePool } from "../data/quotePool.jsx";
import { useStore } from "../stores/useStore.js";
import { savedScreens, saveScreen, deleteScreen } from "../stores/savedScreens.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toggleWatch } from "../ui/watchActions.js";
import { toast } from "../ui/toasts.js";
import { Page } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Input } from "../ui/Input.jsx";
import { Select } from "../ui/Select.jsx";
import { Button } from "../ui/Button.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Freshness } from "../ui/Freshness.jsx";

const NUMERIC_FIELDS = [
  { group: "P/E", keys: ["peMin", "peMax"] },
  { group: "PRICE", keys: ["priceMin", "priceMax"] },
  { group: "MKT CAP $B", keys: ["capMin"] },
  { group: "DIV %", keys: ["yieldMin"] },
  { group: "BETA", keys: ["betaMin", "betaMax"] },
  { group: "52W POS %", keys: ["posMin", "posMax"] },
];
const BOUND_LABEL = { peMin: "MIN", peMax: "MAX", priceMin: "MIN", priceMax: "MAX", capMin: "MIN", yieldMin: "MIN", betaMin: "MIN", betaMax: "MAX", posMin: "MIN", posMax: "MAX" };

export default function Screener() {
  const { query } = useRoute();
  const pool = useQuotePool();
  const { open } = useQuickLook();
  const screens = useStore(savedScreens, (s) => s.items);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const filters = useMemo(() => filtersFromQuery(query), [query]);
  const preset = presetById(query.preset);
  const sort = query.sort ? { key: query.sort, dir: query.dir === "asc" ? "asc" : "desc" } : { key: "marketCap", dir: "desc" };

  const exchanges = useMemo(() => {
    const set = new Set(pool.equities.map((r) => r.exchange).filter(Boolean));
    return [{ value: "", label: "ALL" }, ...Array.from(set).sort().map((e) => ({ value: e, label: e }))];
  }, [pool.equities]);

  const rows = useMemo(() => {
    const base = pool.equities.filter((r) => r.price > 0);
    const byPreset = preset ? base.filter((r) => preset.test(r)) : base;
    return byPreset.filter((r) => matchesFilters(r, filters));
  }, [pool.equities, preset, filters]);

  const setFilter = (key, value) => updateQuery({ [key]: value === "" ? null : value });
  const clearAll = () => updateQuery({ ...Object.fromEntries(Object.keys(FILTER_DEFAULTS).map((k) => [k, null])), preset: null });

  const applySaved = (item) => updateQuery({ ...Object.fromEntries(Object.keys(FILTER_DEFAULTS).map((k) => [k, null])), ...filtersToQuery(item.filters), preset: null });

  const doSave = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    saveScreen(trimmed, filters);
    toast({ title: `SCREEN SAVED · ${trimmed.toUpperCase()}` });
    setName("");
    setNaming(false);
  };

  const columns = [
    { key: "symbol", label: "TICKER", align: "left", width: 92, sortable: true, render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    { key: "name", label: "NAME", align: "left", sortable: true, render: (r) => <span className="pb-muted">{(r.name || "").slice(0, 26)}</span> },
    { key: "price", label: "LAST", sortable: true, render: (r) => <Price value={r.price} format={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} /> },
    { key: "changePercent", label: "CHG %", sortable: true, render: (r) => <Change value={r.changePercent} /> },
    { key: "marketCap", label: "MKT CAP", sortable: true, render: (r) => (r.marketCap > 0 ? fmtK(r.marketCap) : "—") },
    { key: "pe", label: "P/E", sortable: true, render: (r) => (r.pe > 0 ? fmt(r.pe, 1) : "—") },
    { key: "volume", label: "VOL", sortable: true, render: (r) => (r.volume > 0 ? fmtK(r.volume) : "—") },
    { key: "beta", label: "BETA", sortable: true, render: (r) => (r.beta > 0 ? fmt(r.beta) : "—") },
    { key: "dividendYield", label: "DIV %", sortable: true, render: (r) => (r.dividendYield > 0 ? fmt(r.dividendYield) : "—") },
    { key: "pos52", label: "52W POS", sortable: true, sortValue: (r) => pos52(r), render: (r) => { const p = pos52(r); return p == null ? "—" : `${fmt(p * 100, 0)}%`; } },
    { key: "offHigh", label: "OFF HIGH", sortable: true, sortValue: (r) => offHigh(r), render: (r) => { const o = offHigh(r); return o == null ? "—" : <Change value={o * 100} decimals={1} />; } },
    { key: "exchange", label: "EXCH", sortable: true, render: (r) => <span className="pb-muted">{r.exchange || "—"}</span> },
  ];

  return (
    <Page>
      <Section
        mnemonic="EQS"
        title="Equity screener"
        meta={<><span>{rows.length} of {pool.equities.length}</span>{" · "}<Freshness updatedAt={pool.updatedAt} intervalMs={pool.intervalMs} /></>}
        flush
      >
        <div className="pb-scr__chips">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pb-chip${preset && preset.id === p.id ? " pb-chip--on" : ""}`}
              aria-pressed={Boolean(preset && preset.id === p.id)}
              onClick={() => updateQuery({ preset: preset && preset.id === p.id ? null : p.id })}
            >
              {p.label}
            </button>
          ))}
          <span className="pb-scr__sep" aria-hidden="true" />
          {screens.map((s) => (
            <span key={s.id} className="pb-chip pb-chip--saved">
              <button type="button" className="pb-reset pb-chip__apply" onClick={() => applySaved(s)}>{s.name.toUpperCase()}</button>
              <button type="button" className="pb-reset pb-chip__del" aria-label={`Delete screen ${s.name}`} onClick={() => deleteScreen(s.id)}>
                <X size={10} strokeWidth={2} />
              </button>
            </span>
          ))}
          {naming ? (
            <form className="pb-scr__save" onSubmit={doSave}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SCREEN NAME" aria-label="Screen name" mono autoFocus />
              <Button type="submit" variant="primary" size="sm">SAVE</Button>
              <Button size="sm" onClick={() => { setNaming(false); setName(""); }}>CANCEL</Button>
            </form>
          ) : (
            <Button size="sm" onClick={() => setNaming(true)}>SAVE SCREEN</Button>
          )}
        </div>

        <div className="pb-scr__filters">
          <label className="pb-scr__field">
            <span className="pb-label">SEARCH</span>
            <Input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="SYMBOL OR NAME" aria-label="Search" mono />
          </label>
          <label className="pb-scr__field">
            <span className="pb-label">EXCHANGE</span>
            <Select value={filters.exchange} onChange={(v) => setFilter("exchange", v)} options={exchanges} aria-label="Exchange" />
          </label>
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.group} className="pb-scr__field">
              <span className="pb-label">{f.group}</span>
              <div className="pb-scr__bounds">
                {f.keys.map((k) => (
                  <Input
                    key={k}
                    type="number"
                    value={filters[k]}
                    onChange={(e) => setFilter(k, e.target.value)}
                    placeholder={BOUND_LABEL[k]}
                    aria-label={`${f.group} ${BOUND_LABEL[k]}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" onClick={clearAll}>CLEAR</Button>
        </div>

        <DataTable
          label="Screener results"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.symbol}
          sort={sort}
          onSort={(s) => updateQuery({ sort: s.key, dir: s.dir })}
          numbered
          navigable
          virtualize
          height={560}
          loading={pool.loading && !rows.length}
          onRowClick={(r) => open(r.symbol)}
          onRowSpace={(r) => toggleWatch(r.symbol)}
          empty="NO MATCH. LOOSEN THE FILTERS."
        />
      </Section>
    </Page>
  );
}
