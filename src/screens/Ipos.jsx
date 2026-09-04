import { useMemo } from "react";
import { IPO_2026, IPO_2026_LISTED_TICKERS } from "../config.js";
import { fmtK, fmtNum } from "../lib/format.js";
import { mergeLiveQuotes, ipoMarketValue } from "../ipoUtils.js";
import { useQuotes, useIpoCalendar } from "../data/hooks.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { Page } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";

const usd = (n) => (n > 0 ? `$${fmtK(n)}` : "—");
const STATUS_TONE = { listed: "up", priced: "up", expected: "warn", filed: undefined, withdrawn: "down" };

export default function Ipos() {
  const { data: quotes, updatedAt, intervalMs } = useQuotes(IPO_2026_LISTED_TICKERS, 15000);
  const { events, configured, loading: calLoading } = useIpoCalendar();
  const { open } = useQuickLook();
  const rows = useMemo(() => mergeLiveQuotes(IPO_2026, quotes), [quotes]);

  const curatedColumns = [
    {
      key: "company",
      label: "COMPANY",
      align: "left",
      render: (r) => (
        <span className="pb-ipo__co">
          <span>{r.company}</span>
          <span className="pb-muted pb-ipo__sector">{r.sector}</span>
        </span>
      ),
    },
    { key: "ticker", label: "TICKER", align: "left", render: (r) => (r.ticker ? <Ticker symbol={r.ticker} name={r.company} /> : <span className="pb-muted">—</span>) },
    { key: "date", label: "DATE", align: "left", render: (r) => <span className="pb-muted">{r.date}</span> },
    { key: "raised", label: "RAISED", render: (r) => usd(r.raised) },
    { key: "price", label: "LAST", sortValue: (r) => (r.quote ? r.quote.price : null), render: (r) => (r.quote && r.quote.price > 0 ? <Price value={r.quote.price} format={(v) => fmtNum(v)} /> : "—") },
    { key: "chg", label: "CHG", sortValue: (r) => (r.quote ? r.quote.changePercent : null), render: (r) => (r.quote && r.quote.price > 0 ? <Change value={r.quote.changePercent} /> : "—") },
    { key: "value", label: "VALUATION", sortValue: (r) => ipoMarketValue(r), render: (r) => usd(ipoMarketValue(r)) },
    { key: "status", label: "STATUS", render: (r) => <Tag tone={STATUS_TONE[String(r.status).toLowerCase()]}>{String(r.status).toUpperCase()}</Tag> },
  ];

  const calendarColumns = [
    { key: "date", label: "DATE", align: "left", render: (r) => <span className="pb-muted">{r.date || "—"}</span> },
    { key: "name", label: "COMPANY", align: "left", render: (r) => (r.name || "—").slice(0, 40) },
    { key: "symbol", label: "SYMBOL", align: "left", render: (r) => (r.symbol ? <Ticker symbol={r.symbol} name={r.name} /> : <span className="pb-muted">—</span>) },
    { key: "exchange", label: "EXCH", align: "left", render: (r) => <span className="pb-muted">{r.exchange || "—"}</span> },
    { key: "price", label: "PRICE", render: (r) => r.price || "—" },
    { key: "shares", label: "SHARES", render: (r) => (r.shares > 0 ? fmtK(r.shares) : "—") },
    { key: "dealValue", label: "DEAL", render: (r) => usd(r.dealValue) },
    { key: "status", label: "STATUS", render: (r) => (r.status ? <Tag tone={STATUS_TONE[r.status]}>{r.status.toUpperCase()}</Tag> : <span className="pb-muted">—</span>) },
  ];

  return (
    <Page>
      <Section
        mnemonic="IPO"
        title="Top IPOs of 2026"
        meta={<><span>{rows.length} tracked</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></>}
        flush
      >
        <DataTable
          label="Curated 2026 IPOs"
          columns={curatedColumns}
          rows={rows}
          rowKey={(r) => r.rank}
          numbered
          navigable
          onRowClick={(r) => { if (r.ticker) open(r.ticker); }}
          empty="NO DATA"
        />
        <div className="pb-form__hint pb-muted pb-ipo__note">
          Hand-curated from public reporting (CNBC, Yahoo Finance, Renaissance Capital, company
          filings) as of June 2026, not a licensed feed. Listed names show a live price and
          market cap; expected and filed names show only a reported deal size or valuation.
        </div>
      </Section>

      <Section title="IPO calendar" meta={configured ? "recent and upcoming, via Finnhub" : "needs a key"} flush>
        {!configured ? (
          <EmptyState>
            ADD A FREE FINNHUB_API_KEY TO .ENV TO ENABLE THE LIVE CALENDAR. THE CURATED LIST
            ABOVE WORKS WITHOUT IT.
          </EmptyState>
        ) : (
          <DataTable
            label="Live IPO calendar"
            columns={calendarColumns}
            rows={events}
            rowKey={(r, i) => `${r.symbol || r.name}-${r.date}-${i}`}
            numbered
            navigable
            loading={calLoading}
            onRowClick={(r) => { if (r.symbol) open(r.symbol); }}
            empty="NO IPOS IN THE CURRENT WINDOW"
          />
        )}
      </Section>
    </Page>
  );
}
