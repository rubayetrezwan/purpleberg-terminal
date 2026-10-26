import { useMemo } from "react";
import { IPO_2026, IPO_2026_LISTED_TICKERS } from "../config.js";
import { fmtK, fmtNum, fmtDateTable } from "../lib/format.js";
import { mergeLiveQuotes, ipoMarketValue, ipoDateCell } from "../ipoUtils.js";
import { useQuotes, useIpoCalendar } from "../data/hooks.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toggleWatch } from "../ui/watchActions.js";
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
    {
      key: "date",
      label: "DATE",
      align: "left",
      render: (r) => {
        const { label, note } = ipoDateCell(r);
        return (
          <span className="pb-ipo__date">
            <span className={note ? "pb-muted" : ""}>{label}</span>
            {note && <span className={note === "EXP" ? "pb-muted" : "pb-warn"}>{note}</span>}
          </span>
        );
      },
    },
    { key: "raised", label: "RAISED", render: (r) => usd(r.raised) },
    { key: "price", label: "LAST", sortValue: (r) => (r.quote ? r.quote.price : null), render: (r) => (r.quote && r.quote.price > 0 ? <Price value={r.quote.price} format={(v) => fmtNum(v)} /> : "—") },
    { key: "chg", label: "CHG", sortValue: (r) => (r.quote ? r.quote.changePercent : null), render: (r) => (r.quote && r.quote.price > 0 ? <Change value={r.quote.changePercent} /> : "—") },
    { key: "value", label: "VALUATION", sortValue: (r) => ipoMarketValue(r), render: (r) => usd(ipoMarketValue(r)) },
    { key: "status", label: "STATUS", render: (r) => <Tag tone={STATUS_TONE[String(r.status).toLowerCase()]}>{String(r.status).toUpperCase()}</Tag> },
  ];

  // Company first, as in the curated table, so the column a phone keeps
  // pinned while the rest scroll is the one that says which row this is.
  const calendarColumns = [
    { key: "name", label: "COMPANY", align: "left", render: (r) => <span className="pb-clip pb-ipo__name" style={{ "--clip": "40ch" }} title={r.name || ""}>{r.name || "—"}</span> },
    { key: "symbol", label: "SYMBOL", align: "left", render: (r) => (r.symbol ? <Ticker symbol={r.symbol} name={r.name} /> : <span className="pb-muted">—</span>) },
    { key: "date", label: "DATE", align: "left", render: (r) => <span className="pb-muted">{r.date ? fmtDateTable(r.date) : "—"}</span> },
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
        title="Largest of 2026"
        meta={<span className="pb-ipo__meta">{rows.length} TRACKED · <Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></span>}
        flush
      >
        <DataTable
          label="Curated 2026 IPOs"
          className="pb-ipo__table"
          columns={curatedColumns}
          rows={rows}
          rowKey={(r) => r.rank}
          numbered
          navigable
          onRowClick={(r) => { if (r.ticker) open(r.ticker); }}
          onRowSpace={(r) => { if (r.ticker) toggleWatch(r.ticker); }}
          empty="NO DATA"
        />
        <div className="pb-form__hint pb-muted pb-ipo__note">
          CURATED FROM PUBLIC REPORTING (CNBC, YAHOO FINANCE, RENAISSANCE CAPITAL, FILINGS) AS
          OF JUN 2026. NOT A LICENSED FEED. LISTED: LIVE PRICE AND MKT CAP. EXPECTED: REPORTED
          VALUATION ONLY. PAST DUE: THE REPORTED WINDOW ENDED WITH NO LISTING.
        </div>
      </Section>

      {/* Setting up the key is the operator's job, documented in the README;
          the person reading this screen only needs to know the feed is off. */}
      <Section title="Live calendar" meta={configured ? "FINNHUB · RECENT AND UPCOMING" : "OFF"} flush>
        {!configured ? (
          <EmptyState>LIVE IPO CALENDAR NOT CONFIGURED</EmptyState>
        ) : (
          <DataTable
            label="Live IPO calendar"
            className="pb-ipo__table"
            columns={calendarColumns}
            rows={events}
            rowKey={(r, i) => `${r.symbol || r.name}-${r.date}-${i}`}
            numbered
            navigable
            loading={calLoading}
            onRowClick={(r) => { if (r.symbol) open(r.symbol); }}
            onRowSpace={(r) => { if (r.symbol) toggleWatch(r.symbol); }}
            empty="NO IPOS IN THE CURRENT WINDOW"
          />
        )}
      </Section>
    </Page>
  );
}
