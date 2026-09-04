import { useMemo } from "react";
import { INDEX_SYMBOLS, COMMODITY_SYMBOLS, BOND_SYMBOLS } from "../config.js";
import { fmt, fmtK, fmtNum } from "../lib/format.js";
import { breadth } from "../lib/breadth.js";
import { useQuotes } from "../data/hooks.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { useSparklines } from "../data/sparklines.js";
import { useNewsFeed } from "../features/newsFeed.jsx";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toggleWatch } from "../ui/watchActions.js";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Stat, StatRow } from "../ui/Stat.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Sparkline } from "../ui/Sparkline.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Tag } from "../ui/Tag.jsx";

const indexSymbols = INDEX_SYMBOLS.map((i) => i.symbol);
const commoditySymbols = COMMODITY_SYMBOLS.map((c) => c.symbol);
const bondSymbols = BOND_SYMBOLS.map((b) => b.symbol);

function IndexStrip() {
  const { data, loading, updatedAt, intervalMs } = useQuotes(indexSymbols, 15000);
  const rows = INDEX_SYMBOLS.map((idx) => {
    const q = data.find((d) => d.symbol === idx.symbol);
    return { ...idx, price: q ? q.price : 0, chg: q ? q.changePercent : null };
  });
  return (
    <Section mnemonic="WEI" title="World equity indices" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      {loading && !data.length ? (
        <EmptyState>LOADING INDICES…</EmptyState>
      ) : (
        <Grid cols="repeat(5, 1fr)" colsTablet="repeat(3, 1fr)" colsMobile="repeat(2, 1fr)">
          {rows.map((r) => (
            <div key={r.symbol} className="pb-idx">
              <div className="pb-idx__sym">{r.short}</div>
              <div className="pb-idx__name pb-muted">{r.name}</div>
              <div className="pb-idx__val">{r.price > 0 ? fmtNum(r.price, r.price > 10000 ? 0 : 2) : "—"}</div>
              <Change value={r.chg} />
            </div>
          ))}
        </Grid>
      )}
    </Section>
  );
}

function WatchlistPanel() {
  const symbols = useStore(watchlist, (s) => s.symbols);
  const pool = useQuotePool();
  const { series } = useSparklines(symbols);
  const { open } = useQuickLook();

  const rows = useMemo(
    () => symbols.map((s) => pool.bySymbol.get(s) || { symbol: s, price: 0, changePercent: null, marketCap: 0 }),
    [symbols, pool.bySymbol]
  );

  const columns = [
    { key: "symbol", label: "TICKER", align: "left", width: "22%", render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    { key: "spark", label: "5D", align: "left", width: "20%", render: (r) => <Sparkline values={series.get(r.symbol) || []} width={56} height={14} /> },
    { key: "price", label: "LAST", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} /> : "—") },
    { key: "changePercent", label: "CHG", render: (r) => <Change value={r.changePercent} /> },
    { key: "marketCap", label: "MKT CAP", render: (r) => (r.marketCap > 0 ? fmtK(r.marketCap) : "—") },
  ];

  return (
    <Section title="Watchlist" meta={`${symbols.length} names`}>
      <DataTable
        label="Watchlist"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.symbol}
        numbered
        navigable
        onRowClick={(r) => open(r.symbol)}
        onRowSpace={(r) => toggleWatch(r.symbol)}
        empty="NO SYMBOLS. STAR ANY TICKER."
      />
    </Section>
  );
}

function MoversPanel() {
  const pool = useQuotePool();
  const { open } = useQuickLook();
  const movers = useMemo(() => {
    const withChg = pool.equities.filter((q) => q.price > 0 && Number.isFinite(Number(q.changePercent)));
    const sorted = [...withChg].sort((a, b) => b.changePercent - a.changePercent);
    return [...sorted.slice(0, 6), ...sorted.slice(-5)];
  }, [pool.equities]);

  const columns = [
    { key: "symbol", label: "TICKER", align: "left", width: "30%", render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    {
      key: "changePercent",
      label: "CHG",
      render: (r) => (
        <span className="pb-moverow">
          <span className="pb-moverow__bar" aria-hidden="true">
            <i
              className={r.changePercent >= 0 ? "pb-moverow__fill" : "pb-moverow__fill pb-moverow__fill--down"}
              style={{ width: `${Math.min(Math.abs(r.changePercent) * 15, 100)}%` }}
            />
          </span>
          <Change value={r.changePercent} />
        </span>
      ),
    },
  ];

  return (
    <Section title="Movers" meta={`${pool.equities.length} tracked`}>
      <DataTable
        label="Biggest movers"
        columns={columns}
        rows={movers}
        rowKey={(r) => r.symbol}
        numbered
        navigable
        onRowClick={(r) => open(r.symbol)}
        onRowSpace={(r) => toggleWatch(r.symbol)}
        empty="NO DATA"
      />
    </Section>
  );
}

function NewsPanel() {
  const { news, loading, updatedAt, intervalMs } = useNewsFeed();
  const items = (news || []).slice(0, 10);
  return (
    <Section title="News" mnemonic="TOP" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      {loading && !items.length ? (
        <EmptyState>LOADING NEWS…</EmptyState>
      ) : !items.length ? (
        <EmptyState>NO HEADLINES</EmptyState>
      ) : (
        <ol className="pb-newslist">
          {items.map((n, i) => (
            <li key={n.link || n.title} className="pb-newslist__row">
              <span className="pb-newslist__num pb-muted">{i + 1})</span>
              <a className="pb-newslist__body" href={n.link} target="_blank" rel="noopener noreferrer">
                <span className="pb-newslist__meta pb-muted">
                  {n.publishedAt ? new Date(n.publishedAt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                  {" · "}
                  {(n.publisher || "").slice(0, 22)}
                </span>
                <span className="pb-newslist__title">{n.title}</span>
              </a>
              {n.relatedSymbol && <Ticker symbol={n.relatedSymbol} star={false} />}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function BreadthPanel() {
  const pool = useQuotePool();
  const b = useMemo(() => breadth(pool.equities), [pool.equities]);
  return (
    <Section title="Breadth" meta="cross-sectional, today">
      <StatRow>
        <Stat label="Advancing" value={b.total ? b.up : "—"} tone={b.up ? "up" : undefined} />
        <Stat label="Declining" value={b.total ? b.down : "—"} tone={b.down ? "down" : undefined} />
        <Stat label="Positive" value={b.pctUp == null ? "—" : `${fmt(b.pctUp, 0)}%`} />
        <Stat label="Median move" value={b.medianAbs == null ? "—" : `${fmt(b.medianAbs)}%`} />
      </StatRow>
      <KVList>
        <KV k="Best" v={b.best ? <span><Ticker symbol={b.best.symbol} /> <Change value={b.best.chg} /></span> : "—"} />
        <KV k="Worst" v={b.worst ? <span><Ticker symbol={b.worst.symbol} /> <Change value={b.worst.chg} /></span> : "—"} />
        <KV k="Unchanged" v={b.total ? b.flat : "—"} />
      </KVList>
    </Section>
  );
}

function RatesPanel() {
  const { data, updatedAt, intervalMs } = useQuotes(bondSymbols, 60000);
  const bySym = new Map(data.map((d) => [d.symbol, d]));
  const y = (sym) => {
    const q = bySym.get(sym);
    return q && q.price > 0 ? q.price : null;
  };
  const y3m = y("^IRX");
  const y10 = y("^TNX");
  return (
    <Section title="Rates" mnemonic="YAS" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />}>
      <KVList>
        {BOND_SYMBOLS.map((b) => {
          const q = bySym.get(b.symbol);
          // Yahoo reports the yield change in percentage points; basis points
          // are what a rates desk reads, so scale by 100.
          return (
            <KV
              key={b.symbol}
              k={b.tenor}
              v={
                <span>
                  {q && q.price > 0 ? `${fmt(q.price)}%` : "—"}{" "}
                  <Change value={q ? q.change * 100 : null} suffix="bp" decimals={0} />
                </span>
              }
            />
          );
        })}
        <KV k="10Y-3M" v={y10 != null && y3m != null ? `${fmt((y10 - y3m) * 100, 0)} bp` : "—"} />
        <KV
          k="Curve"
          v={y10 != null && y3m != null ? <Tag tone={y10 > y3m ? undefined : "warn"}>{y10 > y3m ? "NORMAL" : "INVERTED"}</Tag> : "—"}
        />
      </KVList>
    </Section>
  );
}

function CommoditiesPanel() {
  const { data, updatedAt, intervalMs } = useQuotes(commoditySymbols, 30000);
  const rows = COMMODITY_SYMBOLS.map((c) => {
    const q = data.find((d) => d.symbol === c.symbol);
    return { ...c, price: q ? q.price : 0, chg: q ? q.changePercent : null };
  });
  const columns = [
    { key: "name", label: "COMMODITY", align: "left", render: (r) => r.name },
    { key: "price", label: "PRICE", render: (r) => (r.price > 0 ? fmtNum(r.price) : "—") },
    { key: "chg", label: "CHG", render: (r) => <Change value={r.chg} /> },
    { key: "unit", label: "UNIT", render: (r) => <span className="pb-muted">{r.unit}</span> },
  ];
  return (
    <Section title="Commodities" mnemonic="CMDT" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />}>
      <DataTable label="Commodities" columns={columns} rows={rows} rowKey={(r) => r.symbol} empty="NO DATA" />
    </Section>
  );
}

export default function Dashboard() {
  return (
    <Page>
      <IndexStrip />
      <Grid cols="1.2fr 1fr 1fr" colsTablet="1fr 1fr" colsMobile="1fr">
        <WatchlistPanel />
        <MoversPanel />
        <NewsPanel />
      </Grid>
      <Grid cols="1.2fr 1fr 1fr" colsTablet="1fr 1fr" colsMobile="1fr">
        <BreadthPanel />
        <RatesPanel />
        <CommoditiesPanel />
      </Grid>
    </Page>
  );
}
