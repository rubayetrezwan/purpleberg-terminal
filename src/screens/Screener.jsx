import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { fmt, fmtK, fmtNum } from "../lib/format.js";
import { exchangeLabel } from "../lib/exchange.js";
import {
  PRESETS, presetById, matchesFilters, pos52, offHigh, positiveOrNull, nonZeroOrNull,
  FILTER_DEFAULTS, INDEX_FILTERS, filtersToQuery, filtersFromQuery, activeFilterCount, filterProblems,
} from "../lib/screener.js";
import { SECTORS } from "../data/universe.js";
import { useIsMobile } from "../data/hooks.js";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useQuotePool } from "../data/quotePool.jsx";
import { useStore } from "../stores/useStore.js";
import { savedScreens, saveScreen, deleteScreen, restoreScreen, screenMatches } from "../stores/savedScreens.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toggleWatch } from "../ui/watchActions.js";
import { toast } from "../ui/toasts.js";
import { Page } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
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

// Every sortable column key, so a `?sort=` from the URL can be validated
// before it reaches the table.
const SORT_KEYS = new Set([
  "symbol", "name", "price", "changePercent", "marketCap", "pe", "volume",
  "beta", "dividendYield", "pos52", "offHigh", "sector", "exchange",
]);
// A first click on a text column reads A to Z; on a number, biggest first.
const TEXT_SORT_KEYS = new Set(["symbol", "name", "sector", "exchange"]);

const SECTOR_OPTIONS = [{ value: "", label: "ALL" }, ...SECTORS.map((s) => ({ value: s, label: s.toUpperCase() }))];
const INDEX_OPTIONS = [{ value: "", label: "ALL" }, ...INDEX_FILTERS.map(({ value, label }) => ({ value, label }))];

export default function Screener() {
  const { query } = useRoute();
  const pool = useQuotePool();
  const { open } = useQuickLook();
  const isPhone = useIsMobile(768);
  const screens = useStore(savedScreens, (s) => s.items);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo(() => filtersFromQuery(query), [query]);
  const preset = presetById(query.preset);
  const presetId = preset ? preset.id : null;
  // A sort key that matches no column would leave the table in raw pool order
  // (alphabetical) with no header marked sorted, so an old bookmark or a typo
  // falls back to the default instead of looking unsorted. Phones have no
  // NAME column, so a link sorted by name does the same there.
  const sortKey = SORT_KEYS.has(query.sort) && !(isPhone && query.sort === "name") ? query.sort : "marketCap";
  const sort = { key: sortKey, dir: query.sort === sortKey && query.dir === "asc" ? "asc" : "desc" };

  // One option per exchange name, so NMS, NGM and NCM are a single NASDAQ.
  const exchanges = useMemo(() => {
    const set = new Set(pool.equities.map((r) => exchangeLabel(r.exchange)).filter(Boolean));
    return [{ value: "", label: "ALL" }, ...Array.from(set).sort().map((e) => ({ value: e, label: e }))];
  }, [pool.equities]);

  const rows = useMemo(() => {
    const base = pool.equities.filter((r) => r.price > 0);
    const byPreset = preset ? base.filter((r) => preset.test(r)) : base;
    return byPreset.filter((r) => matchesFilters(r, filters));
  }, [pool.equities, preset, filters]);

  const problems = useMemo(() => filterProblems(filters), [filters]);
  const invalid = new Set(problems.flatMap((p) => p.keys));
  // The search box stays on screen on a phone, so the FILTERS count is only
  // what is hidden behind the toggle.
  const hiddenCount = activeFilterCount({ ...filters, q: "" });
  const blank = !preset && activeFilterCount(filters) === 0;

  const setFilter = (key, value) => updateQuery({ [key]: value === "" ? null : value });
  const clearAll = () => updateQuery({ ...Object.fromEntries(Object.keys(FILTER_DEFAULTS).map((k) => [k, null])), preset: null });

  // A screen saved before presets and sorts were stored has neither: it
  // clears the preset as it always did and leaves the current sort alone.
  const applySaved = (item) => updateQuery({
    ...Object.fromEntries(Object.keys(FILTER_DEFAULTS).map((k) => [k, null])),
    ...filtersToQuery(item.filters),
    preset: item.preset || null,
    ...(item.sort ? { sort: item.sort.key, dir: item.sort.dir } : {}),
  });

  // A screen with no filter and no preset is the whole universe: saving it
  // would only add a chip that does nothing.
  const refuseBlank = () => toast({ tone: "warn", title: "NOTHING TO SAVE", body: "SET A FILTER OR A PRESET FIRST." });

  const startSave = () => {
    if (blank) { refuseBlank(); return; }
    setNaming(true);
  };

  const doSave = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (blank) { refuseBlank(); return; }
    saveScreen(trimmed, filters, { preset: presetId, sort });
    toast({ title: `SCREEN SAVED · ${trimmed.toUpperCase()}` });
    setName("");
    setNaming(false);
  };

  const removeSaved = (item) => {
    const removed = deleteScreen(item.id);
    if (!removed) return;
    toast({
      title: `SCREEN DELETED · ${item.name.toUpperCase()}`,
      actions: [{ label: "UNDO", run: () => restoreScreen(removed.item, removed.index) }],
    });
  };

  const onSort = (s) => {
    // The table flips a column it already sorts, and opens any other one
    // descending; a text column should open A to Z instead.
    const dir = s.key === sort.key ? s.dir : TEXT_SORT_KEYS.has(s.key) ? "asc" : "desc";
    updateQuery({ sort: s.key, dir });
  };

  const columns = [
    { key: "symbol", label: "TICKER", align: "left", width: 92, sortable: true, render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    // The name column takes whatever width the others leave, and only cuts
    // a name that really does not fit. Phones drop it so LAST and CHG fit.
    !isPhone && { key: "name", label: "NAME", align: "left", width: "100%", sortable: true, render: (r) => <span className="pb-muted pb-scr__name" title={r.name || ""}>{r.name || ""}</span> },
    { key: "price", label: "LAST", sortable: true, render: (r) => <Price value={r.price} format={(v) => fmtNum(v, 2)} /> },
    { key: "changePercent", label: "CHG %", sortable: true, render: (r) => <Change value={r.changePercent} /> },
    // These print "—" for the proxy's placeholder 0, so they sort it as
    // missing too; otherwise an ascending sort opens on a block of blanks.
    { key: "marketCap", label: "MKT CAP", sortable: true, sortValue: (r) => positiveOrNull(r.marketCap), render: (r) => (r.marketCap > 0 ? fmtK(r.marketCap) : "—") },
    { key: "pe", label: "P/E", sortable: true, sortValue: (r) => positiveOrNull(r.pe), render: (r) => (r.pe > 0 ? fmtNum(r.pe, 1) : "—") },
    { key: "volume", label: "VOL", sortable: true, sortValue: (r) => positiveOrNull(r.volume), render: (r) => (r.volume > 0 ? fmtK(r.volume) : "—") },
    { key: "beta", label: "BETA", sortable: true, sortValue: (r) => nonZeroOrNull(r.beta), render: (r) => { const b = nonZeroOrNull(r.beta); return b == null ? "—" : fmt(b); } },
    { key: "dividendYield", label: "DIV %", sortable: true, sortValue: (r) => positiveOrNull(r.dividendYield), render: (r) => (r.dividendYield > 0 ? fmt(r.dividendYield) : "—") },
    // Floored, not rounded: a stock 0.1% off its high must not read 100% in
    // the column next to that -0.1%.
    { key: "pos52", label: "52W POS", sortable: true, sortValue: (r) => pos52(r), render: (r) => { const p = pos52(r); return p == null ? "—" : `${Math.floor(p * 100)}%`; } },
    { key: "offHigh", label: "OFF HIGH", sortable: true, sortValue: (r) => offHigh(r), render: (r) => { const o = offHigh(r); return o == null ? "—" : <Change value={o * 100} decimals={1} />; } },
    { key: "sector", label: "SECTOR", align: "left", sortable: true, render: (r) => <span className="pb-muted">{r.sector ? r.sector.toUpperCase() : "—"}</span> },
    { key: "exchange", label: "EXCH", sortable: true, sortValue: (r) => exchangeLabel(r.exchange) || null, render: (r) => <span className="pb-muted">{exchangeLabel(r.exchange) || "—"}</span> },
  ].filter(Boolean);

  const saveForm = (
    <form className="pb-scr__save" onSubmit={doSave}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SCREEN NAME" aria-label="Screen name" maxLength={40} mono autoFocus />
      <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>SAVE</Button>
      <Button size="sm" onClick={() => { setNaming(false); setName(""); }}>CANCEL</Button>
    </form>
  );

  const searchInput = (
    <Input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="SYMBOL OR NAME" aria-label="Search" mono />
  );

  // The empty state sits in a cell as wide as the whole table, so it is held
  // to the visible width (see .pb-scr__empty) and says why when it can.
  const emptyText = problems.length ? `NO MATCH · ${problems.map((p) => p.text).join(" · ")}` : "NO MATCH. LOOSEN THE FILTERS.";

  return (
    <Page className="pb-page--fill">
      <Section
        mnemonic="EQS"
        title="Equity screener"
        className="pb-scr"
        meta={<><span>{rows.length}/{pool.equities.length}</span>{" · "}<Freshness updatedAt={pool.updatedAt} intervalMs={pool.intervalMs} /></>}
        flush
      >
        <div className="pb-scr__chips">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pb-chip${presetId === p.id ? " pb-chip--on" : ""}`}
              aria-pressed={presetId === p.id}
              onClick={() => updateQuery({ preset: presetId === p.id ? null : p.id })}
            >
              {p.label}
            </button>
          ))}
          <span className="pb-scr__sep" aria-hidden="true" />
          {screens.map((s) => {
            const on = screenMatches(s, filters, presetId);
            return (
              <span key={s.id} className={`pb-chip pb-chip--saved${on ? " pb-chip--on" : ""}`}>
                <button type="button" className="pb-reset pb-chip__apply" title={s.name.toUpperCase()} aria-pressed={on} onClick={() => applySaved(s)}>
                  {s.name.toUpperCase()}
                </button>
                <button type="button" className="pb-reset pb-chip__del" aria-label={`Delete screen ${s.name}`} onClick={() => removeSaved(s)}>
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            );
          })}
          {naming && !isPhone ? saveForm : !naming && <Button size="sm" onClick={startSave}>SAVE SCREEN</Button>}
        </div>
        {naming && isPhone && <div className="pb-scr__saverow">{saveForm}</div>}

        {isPhone && (
          <div className="pb-scr__bar">
            {searchInput}
            <Button
              size="sm"
              className={hiddenCount ? "pb-scr__toggle--on" : ""}
              aria-expanded={filtersOpen}
              aria-controls="pb-scr-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              FILTERS{hiddenCount ? ` · ${hiddenCount}` : ""}
            </Button>
          </div>
        )}

        {(!isPhone || filtersOpen) && (
          <div className="pb-scr__filters" id="pb-scr-filters">
            {!isPhone && (
              <label className="pb-scr__field">
                <span className="pb-label">SEARCH</span>
                {searchInput}
              </label>
            )}
            <label className="pb-scr__field">
              <span className="pb-label">INDEX</span>
              <Select value={filters.index} onChange={(v) => setFilter("index", v)} options={INDEX_OPTIONS} aria-label="Index" />
            </label>
            <label className="pb-scr__field">
              <span className="pb-label">SECTOR</span>
              <Select value={filters.sector} onChange={(v) => setFilter("sector", v)} options={SECTOR_OPTIONS} aria-label="Sector" />
            </label>
            <label className="pb-scr__field">
              <span className="pb-label">EXCHANGE</span>
              <Select value={exchangeLabel(filters.exchange)} onChange={(v) => setFilter("exchange", v)} options={exchanges} aria-label="Exchange" />
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
                      aria-invalid={invalid.has(k) || undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
            <Button size="sm" className="pb-scr__clear" onClick={clearAll}>CLEAR</Button>
          </div>
        )}

        <DataTable
          label="Screener results"
          className="pb-scr__dt"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.symbol}
          sort={sort}
          onSort={onSort}
          numbered
          navigable
          virtualize
          height="fill"
          loading={pool.loading && !rows.length}
          onRowClick={(r) => open(r.symbol)}
          onRowSpace={(r) => toggleWatch(r.symbol)}
          empty={<EmptyState className="pb-scr__empty">{emptyText}</EmptyState>}
        />
      </Section>
    </Page>
  );
}
