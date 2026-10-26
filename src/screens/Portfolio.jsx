import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { ChartKey } from "../ui/ChartKey.jsx";
import { Trash2 } from "lucide-react";
import { useRoute, updateQuery } from "../router/index.jsx";
import { api } from "../data/api.js";
import { useHistorical, useIsMobile } from "../data/hooks.js";
import { useQuotePool, usePoolExtra } from "../data/quotePool.jsx";
import { useStore } from "../stores/useStore.js";
import {
  portfolio, migratePortfolio, replaceTransactions, addTransaction,
  appendTransactions, removeTransaction,
} from "../stores/portfolio.js";
import {
  positionsFrom, enrichPositions, portfolioTotals, allocation, performanceSeries, riskMetrics, beta,
  sortTransactions, toCsv, parseCsv, sampleTransactions, newlyRejected, MIN_RISK_POINTS,
} from "../lib/portfolio.js";
import { normalizeSymbol } from "../lib/ticker.js";
import { tradeDate } from "../lib/session.js";
import { fmtNum, fmtPct, fmtSigned, fmtAxisDate } from "../lib/format.js";
import { niceTicks } from "../lib/axis.js";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Tabs } from "../ui/Tabs.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Stat, StatRow } from "../ui/Stat.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Button } from "../ui/Button.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";
import { TransactionForm } from "../features/TransactionForm.jsx";
import { toggleWatch } from "../ui/watchActions.js";
import { useQuickLook } from "../ui/quickLookContext.js";
import { toast } from "../ui/toasts.js";
import { confirm } from "../ui/dialog.js";

const BENCH = "^GSPC";
const BILL = "^IRX";
const TABS = [
  { value: "holdings", label: "HOLDINGS" },
  { value: "transactions", label: "TRANSACTIONS" },
  { value: "allocation", label: "ALLOCATION" },
  { value: "risk", label: "RISK" },
];
const TAB_VALUES = TABS.map((t) => t.value);

const money = (n, d = 2) => (n == null ? "—" : `${n < 0 ? "-" : ""}$${fmtNum(Math.abs(n), d)}`);
const moneySigned = (n, d = 2) => (n == null ? "—" : `${n < 0 ? "-" : "+"}$${fmtNum(Math.abs(n), d)}`);
const tone = (n) => (n == null ? undefined : n > 0 ? "up" : n < 0 ? "down" : undefined);
const shareStr = (n) => fmtNum(n, n % 1 === 0 ? 0 : 4);

// One-time import of the older {symbol, shares, avgCost} holdings list. Only
// runs while the transaction store is empty, so nothing entered since is
// overwritten.
function useMigration() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (portfolio.get().transactions.length) return;
    let migrated = null;
    try { migrated = migratePortfolio(window.localStorage); } catch { migrated = null; }
    if (migrated && migrated.transactions.length) {
      replaceTransactions(migrated.transactions);
      toast({
        title: `IMPORTED ${migrated.transactions.length} HOLDINGS`,
        body: `Each old holding became one buy dated ${migrated.transactions[0].date}. Edit the dates on the transactions tab for accurate returns.`,
        ttlMs: 9000,
      });
    }
  }, []);
}

// Daily closes for several symbols at once. The proxy caches per symbol, so
// re-fetching on a holdings change is cheap.
function useHistories(symbols, range = "1y") {
  const key = symbols.join(",");
  const [state, setState] = useState({ key, bySymbol: {}, loading: symbols.length > 0 });
  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) { setState({ key, bySymbol: {}, loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    Promise.all(
      list.map((s) => api.historical(s, range, "1d").then((rows) => [s, Array.isArray(rows) ? rows : []]).catch(() => [s, []]))
    ).then((pairs) => {
      if (!cancelled) setState({ key, bySymbol: Object.fromEntries(pairs), loading: false });
    });
    return () => { cancelled = true; };
  }, [key, range]);
  // Until the effect has run for a new list (a first trade in a new symbol),
  // the state still holds the old list's closes, so it counts as loading.
  return { bySymbol: state.bySymbol, loading: state.loading || state.key !== key };
}

// Sector per symbol, fetched only once the allocation tab is open.
function useSectors(symbols, enabled) {
  const [bySymbol, setBySymbol] = useState({});
  const asked = useRef(new Set());
  const key = symbols.join(",");
  useEffect(() => {
    if (!enabled || !key) return undefined;
    const missing = key.split(",").filter((s) => !asked.current.has(s));
    if (!missing.length) return undefined;
    missing.forEach((s) => asked.current.add(s));
    let cancelled = false;
    Promise.all(
      missing.map((s) =>
        api.financials(s)
          .then((f) => [s, (f && f.profile && f.profile.sector && f.profile.sector !== "N/A" ? f.profile.sector : "UNKNOWN")])
          .catch(() => [s, "UNKNOWN"])
      )
    ).then((pairs) => { if (!cancelled) setBySymbol((prev) => ({ ...prev, ...Object.fromEntries(pairs) })); });
    // A cancelled fetch never resolved into state, so let a later mount retry.
    return () => { cancelled = true; missing.forEach((s) => asked.current.delete(s)); };
  }, [key, enabled]);
  return bySymbol;
}

function AllocationList({ rows, label }) {
  if (!rows.length) return <EmptyState>NO LIVE VALUE TO WEIGH</EmptyState>;
  return (
    <ol className="pb-alloc" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.key} className="pb-alloc__row">
          <span className="pb-alloc__num pb-muted">{i + 1})</span>
          <span className="pb-alloc__key" title={r.key}>{r.key}</span>
          <span className="pb-alloc__bar" aria-hidden="true">
            <span className="pb-alloc__fill" style={{ width: `${Math.min(100, r.pct).toFixed(1)}%` }} />
          </span>
          <span className="pb-alloc__pct">{fmtNum(r.pct, 1)}%</span>
          <span className="pb-alloc__val pb-muted">{money(r.value, 0)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Portfolio() {
  const { query } = useRoute();
  const tab = TAB_VALUES.includes(query.tab) ? query.tab : "holdings";
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, lineProps } = useChartTheme();
  const { open: openQuickLook } = useQuickLook();
  useMigration();

  const transactions = useStore(portfolio, (s) => s.transactions);
  const { positions, rejected } = useMemo(() => positionsFrom(transactions), [transactions]);
  const openSymbols = useMemo(
    () => positions.filter((p) => p.shares > 0).map((p) => p.symbol).sort(),
    [positions]
  );
  // Prices come from the shared quote pool, which already polls every
  // transaction symbol and the S&P 500, so holdings show the same prices as
  // the rest of the terminal instead of a second poll one tick apart. The
  // 3-month bill is not in the pool, so it joins while this screen is open.
  usePoolExtra(BILL);
  const { bySymbol, updatedAt, intervalMs } = useQuotePool();

  // ADD TO PORTFOLIO in the quick look lands here with ?symbol=. The form
  // takes it as its starting symbol and the parameter is then dropped, so a
  // second click on the same symbol still reads as a new seed.
  const seedSymbol = tab === "transactions" ? normalizeSymbol(query.symbol) : null;
  useEffect(() => {
    if (tab === "transactions" && query.symbol) updateQuery({ symbol: null });
  }, [tab, query.symbol]);

  const accepted = useMemo(() => {
    const bad = new Set(rejected.map((r) => r.transaction && r.transaction.id));
    return transactions.filter((t) => !bad.has(t.id));
  }, [transactions, rejected]);
  // Day P&L needs today's trades, and "today" is the New York trade date.
  // Every poll re-renders, so this moves on with the clock.
  const today = tradeDate();
  const rows = useMemo(
    () => enrichPositions(positions, bySymbol, { transactions: accepted, today }),
    [positions, bySymbol, accepted, today]
  );
  const openRows = useMemo(() => rows.filter((r) => r.shares > 0), [rows]);
  const totals = useMemo(() => portfolioTotals(rows), [rows]);

  // ── Performance ──
  const { data: benchRows, loading: benchLoading } = useHistorical(BENCH, "1y");
  // Every symbol ever transacted, not just the open ones: a position that has
  // been sold was still held on the days before the sale, and without its
  // closes it would contribute nothing to the value on those days while its
  // buy and sell still count as cash flows — which turns a gain into a loss.
  const seriesSymbols = useMemo(
    () => [...new Set(accepted.map((t) => t.symbol))].sort(),
    [accepted]
  );
  const { bySymbol: closes, loading: closesLoading } = useHistories(seriesSymbols, "1y");
  // Symbols whose history came back empty or failed. valueSeries carries them
  // at their last trade price, and the chart says so.
  const noHistory = useMemo(
    () => (closesLoading ? [] : seriesSymbols.filter((s) => !(closes[s] || []).some((r) => Number(r.close) > 0))),
    [closesLoading, seriesSymbols, closes]
  );

  const series = useMemo(() => {
    // Built only once every symbol's closes are in. A half-loaded set values
    // the missing symbols at nothing while their buys still count as cash in,
    // which the chain reads as a crash.
    if (closesLoading) return null;
    return performanceSeries(accepted, closes, benchRows);
  }, [benchRows, closes, closesLoading, accepted]);
  const chartReady = Boolean(series && series.chart.length >= 2);
  // Round ticks over both lines and the 100 base, so the base is always on
  // the axis and neighbouring labels never repeat ("100, 100, 100, 99").
  const yScale = useMemo(() => {
    if (!chartReady) return null;
    const vals = [100];
    for (const p of series.chart) vals.push(p.port, p.bench);
    return niceTicks(vals, isMobile ? 4 : 5);
  }, [chartReady, series, isMobile]);

  const rf = useMemo(() => {
    const bill = bySymbol.get(BILL);
    return bill && Number(bill.price) > 0 ? Number(bill.price) / 100 : 0;
  }, [bySymbol]);
  const risk = useMemo(
    () => (series ? riskMetrics(series.returns, series.index, { rf }) : null),
    [series, rf]
  );
  const portBeta = useMemo(
    () => (series ? beta(series.returns, series.benchReturns) : null),
    [series]
  );

  const sectors = useSectors(openSymbols, tab === "allocation");
  const byHolding = useMemo(() => allocation(openRows), [openRows]);
  const bySector = useMemo(
    () => allocation(openRows.map((r) => ({ ...r, sector: sectors[r.symbol] || "UNKNOWN" })), (r) => r.sector),
    [openRows, sectors]
  );

  // Deleting a buy can leave a later sell without the shares it sold; the
  // accounting would then drop that sell and keep its shares open. Refuse,
  // and name the sell so it is clear which one to delete first.
  const doDelete = (t) => {
    const broken = newlyRejected(transactions, transactions.filter((x) => x.id !== t.id));
    if (broken.length) {
      const s = broken[0];
      toast({
        tone: "warn",
        title: "DELETE THE LATER SELL FIRST",
        body: `Without this buy, the ${s.date} sell of ${shareStr(Number(s.shares))} ${s.symbol} is not covered.`,
      });
      return;
    }
    removeTransaction(t.id);
  };

  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const doExport = () => {
    const blob = new Blob([toCsv(transactions)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purpleberg-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: `EXPORTED ${transactions.length} TRANSACTIONS` });
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      setPreview(parsed);
    } catch {
      toast({ tone: "warn", title: "IMPORT FAILED", body: "Could not read the file" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const commitImport = () => {
    if (!preview || !preview.rows.length) return;
    appendTransactions(preview.rows);
    toast({ title: `IMPORTED ${preview.rows.length} TRANSACTIONS` });
    setPreview(null);
  };

  const doClear = async () => {
    const ok = await confirm({
      title: "CLEAR THE PORTFOLIO",
      body: `Delete all ${transactions.length} transactions. This cannot be undone.`,
      confirmLabel: "CLEAR",
      danger: true,
    });
    if (ok) { replaceTransactions([]); toast({ title: "PORTFOLIO CLEARED" }); }
  };

  // The sample carries fallback prices; replacing each with the actual close on
  // its date keeps the basis, the return on cost, and the performance line
  // consistent with each other instead of inventing a gain.
  const [samplePending, setSamplePending] = useState(false);
  const loadSample = async () => {
    setSamplePending(true);
    const rows = sampleTransactions();
    const symbols = [...new Set(rows.map((r) => r.symbol))];
    let priced = 0;
    try {
      const pairs = await Promise.all(
        symbols.map((s) => api.historical(s, "1y", "1d").then((h) => [s, Array.isArray(h) ? h : []]).catch(() => [s, []]))
      );
      const hist = new Map(pairs);
      for (const r of rows) {
        let close = null;
        for (const row of hist.get(r.symbol) || []) {
          if (row.date > r.date) break;
          if (Number(row.close) > 0) close = Number(row.close);
        }
        if (close != null) { r.price = Math.round(close * 100) / 100; priced += 1; }
      }
    } catch { /* fall back to the illustrative prices */ }
    replaceTransactions(rows);
    setSamplePending(false);
    toast({
      title: "SAMPLE PORTFOLIO LOADED",
      body: priced === rows.length
        ? "Eight buys priced at the actual close on each date."
        : `Eight buys; ${rows.length - priced} kept an illustrative price because history was unavailable.`,
    });
  };

  // The transactions tab is where the first trade gets entered, so it must
  // render even when there is nothing yet.
  if (!transactions.length && tab !== "transactions") {
    return (
      <Page>
        <Section mnemonic="PORT" title="Portfolio">
          <EmptyState>
            NO TRANSACTIONS YET. LOAD THE SAMPLE PORTFOLIO, OR ADD A TRANSACTION (A CSV CAN
            BE IMPORTED THERE TOO). EVERYTHING STAYS IN THIS BROWSER.
          </EmptyState>
          <div className="pb-txform__row pb-port__emptyactions">
            <Button variant="primary" loading={samplePending} onClick={loadSample}>LOAD SAMPLE</Button>
            <Button onClick={() => updateQuery({ tab: "transactions" })}>ADD A TRANSACTION</Button>
          </div>
        </Section>
      </Page>
    );
  }

  const staleNote = totals.staleCount > 0 ? `${totals.staleCount} without a live quote` : null;
  // Nothing traded is no P&L, not a P&L of zero: "+$0" beside three em dashes.
  const totalPnl = !accepted.length ? null
    : totals.unrealised == null ? totals.realised : totals.unrealised + totals.realised;

  const holdingColumns = [
    { key: "symbol", label: "SYMBOL", align: "left", render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    { key: "shares", label: "SHARES", render: (r) => shareStr(r.shares) },
    // Every money column in cents with a "$", so AVG COST and LAST compare
    // digit for digit and VALUE and P&L do not drop precision beside them.
    { key: "avgCost", label: "AVG COST", render: (r) => money(r.avgCost) },
    { key: "price", label: "LAST", sortValue: (r) => r.price, render: (r) => (r.price == null ? <Tag tone="warn">NO QUOTE</Tag> : <Price value={r.price} format={(v) => money(v)} />) },
    { key: "chg", label: "CHG", sortValue: (r) => r.changePercent, render: (r) => <Change value={r.changePercent} /> },
    { key: "dayPnl", label: "DAY P&L", sortValue: (r) => r.dayPnl, render: (r) => <span className={r.dayPnl == null ? "" : `pb-${tone(r.dayPnl) || "muted"}`}>{moneySigned(r.dayPnl)}</span> },
    { key: "value", label: "VALUE", sortValue: (r) => r.value, render: (r) => money(r.value) },
    { key: "unrealised", label: "UNREAL P&L", sortValue: (r) => r.unrealised, render: (r) => <span className={r.unrealised == null ? "" : `pb-${tone(r.unrealised) || "muted"}`}>{moneySigned(r.unrealised)}</span> },
    { key: "unrealisedPct", label: "RETURN", sortValue: (r) => r.unrealisedPct, render: (r) => <Change value={r.unrealisedPct} /> },
    { key: "weight", label: "WEIGHT", sortValue: (r) => (r.live && totals.value > 0 ? (r.value / totals.value) * 100 : null), render: (r) => (r.live && totals.value > 0 ? `${fmtNum((r.value / totals.value) * 100, 1)}%` : "—") },
  ];

  // A phone drops FEES and NOTE so AMOUNT and the delete button stay on screen.
  const PHONE_HIDDEN = new Set(["fees", "note"]);
  const txColumnsAll = [
    { key: "date", label: "DATE", align: "left", render: (t) => <span className="pb-muted">{t.date}</span> },
    { key: "symbol", label: "SYMBOL", align: "left", render: (t) => <Ticker symbol={t.symbol} star={false} /> },
    { key: "side", label: "SIDE", align: "left", render: (t) => <Tag tone={t.side === "buy" ? "up" : "down"}>{t.side.toUpperCase()}</Tag> },
    { key: "shares", label: "SHARES", render: (t) => shareStr(Number(t.shares)) },
    { key: "price", label: "PRICE", render: (t) => money(Number(t.price)) },
    { key: "fees", label: "FEES", render: (t) => (Number(t.fees) > 0 ? money(Number(t.fees)) : "—") },
    { key: "gross", label: "AMOUNT", sortValue: (t) => Number(t.shares) * Number(t.price), render: (t) => money(Number(t.shares) * Number(t.price), 0) },
    { key: "note", label: "NOTE", align: "left", render: (t) => <span className="pb-muted">{t.note || ""}</span> },
    {
      key: "del",
      label: "",
      render: (t) => (
        <Button size="sm" onClick={() => doDelete(t)} aria-label={`Delete the ${t.date} ${t.symbol} ${t.side}`}>
          <Trash2 size={11} strokeWidth={1.5} />
        </Button>
      ),
    },
  ];
  const txColumns = isMobile ? txColumnsAll.filter((c) => !PHONE_HIDDEN.has(c.key)) : txColumnsAll;

  return (
    <Page>
      <Section
        mnemonic="PORT"
        title="Portfolio"
        meta={<><span>{totals.holdings} holding{totals.holdings === 1 ? "" : "s"}, {transactions.length} transaction{transactions.length === 1 ? "" : "s"}{staleNote ? `, ${staleNote}` : ""}</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></>}
      >
        <StatRow cols={isMobile ? "1fr 1fr" : "repeat(5, 1fr)"}>
          <Stat label="VALUE" value={money(totals.value, 0)} size="lg" />
          <Stat
            label="DAY P&L"
            value={moneySigned(totals.dayPnl, 0)}
            sub={totals.dayPnlMissing > 0 ? `${totals.dayPnlMissing} without a previous close` : null}
            tone={tone(totals.dayPnl)}
            size="lg"
          />
          <Stat
            label="TOTAL P&L"
            value={moneySigned(totalPnl, 0)}
            sub={totals.realised !== 0 ? `${moneySigned(totals.realised, 0)} realised` : null}
            tone={tone(totalPnl)}
            size="lg"
          />
          <Stat label="RETURN ON COST" value={fmtPct(totals.returnPct)} tone={tone(totals.returnPct)} size="lg" />
          <Stat
            label="VS S&P 500"
            value={series && series.portPct != null && series.benchPct != null ? `${fmtSigned(series.portPct - series.benchPct, 1)} pts` : "—"}
            sub={series ? `${fmtPct(series.portPct, 1)} vs ${fmtPct(series.benchPct, 1)} since ${series.from}` : "needs history"}
            tone={series && series.portPct != null && series.benchPct != null ? tone(series.portPct - series.benchPct) : undefined}
            size="lg"
          />
        </StatRow>
      </Section>

      <Section
        title="Performance"
        meta={series ? `time-weighted, ${series.days} session${series.days === 1 ? "" : "s"} from ${series.from}` : "since the first transaction"}
      >
        {chartReady && (
          <div className="pb-chartbar">
            <ChartKey items={[{ label: "PORTFOLIO", color: colors.series[0], line: true }, { label: "S&P 500", color: colors.series[2], dashed: true }]} />
          </div>
        )}
        <ChartFrame
          height={isMobile ? 200 : 260}
          loading={(benchLoading || closesLoading) && !series}
          empty={!chartReady ? "NOT ENOUGH HISTORY YET" : null}
        >
          <LineChart data={series ? series.chart : []}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => fmtAxisDate(d, false)} minTickGap={40} />
            <YAxis
              {...axisProps}
              width={44}
              domain={yScale ? yScale.domain : ["auto", "auto"]}
              ticks={yScale ? yScale.ticks : undefined}
              tickFormatter={(v) => fmtNum(v, yScale ? yScale.decimals : 0)}
            />
            <ReferenceLine y={100} stroke={colors.muted} strokeWidth={1} ifOverflow="extendDomain" />
            {/* ISO, as in the transactions table. */}
            <Tooltip {...tooltipProps} labelFormatter={(d) => d} formatter={(v, n) => [fmtNum(v, 1), n]} />
            <Line dataKey="port" name="PORTFOLIO" stroke={colors.series[0]} {...lineProps} />
            <Line dataKey="bench" name="S&P 500" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" connectNulls />
          </LineChart>
        </ChartFrame>
        {noHistory.length > 0 && (
          <div className="pb-form__hint pb-warn">
            No history for {noHistory.join(", ")}; carried flat at the last trade price.
          </div>
        )}
        {chartReady && (
          <div className="pb-form__hint pb-muted">
            Both lines start at 100 on the close before the first trade. Time-weighted:
            deposits and withdrawals are not gains.
          </div>
        )}
      </Section>

      <Tabs label="Portfolio views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "holdings" ? null : v })} />

      {tab === "holdings" && (
        <Section title="Holdings" meta={staleNote} flush>
          <DataTable
            label="Holdings"
            columns={holdingColumns}
            rows={openRows}
            rowKey={(r) => r.symbol}
            numbered
            navigable
            onRowClick={(r) => openQuickLook(r.symbol)}
            onRowSpace={(r) => toggleWatch(r.symbol)}
            empty="NO OPEN POSITIONS"
          />
          {rows.some((r) => r.shares === 0) && (
            <div className="pb-form__hint pb-muted">
              Closed positions are not listed; their realised P&L is in the total above.
            </div>
          )}
        </Section>
      )}

      {tab === "transactions" && (
        <>
          <Section title="Add a transaction">
            <TransactionForm transactions={transactions} initialSymbol={seedSymbol} onAdd={(t) => { addTransaction(t); toast({ title: `${t.side.toUpperCase()} ${t.symbol} RECORDED` }); }} />
          </Section>

          <Section
            title="Transactions"
            meta={`${transactions.length}`}
            actions={
              <>
                <Button size="sm" disabled={!transactions.length} onClick={doExport}>EXPORT CSV</Button>
                <Button size="sm" onClick={() => fileRef.current && fileRef.current.click()}>IMPORT CSV</Button>
                <input ref={fileRef} type="file" accept="text/csv,.csv,.txt" className="pb-sr-only" onChange={(e) => doImport(e.target.files && e.target.files[0])} aria-label="Import transactions CSV" />
                <Button size="sm" variant="danger" disabled={!transactions.length} onClick={doClear}>CLEAR</Button>
              </>
            }
            flush
          >
            {preview && (
              <div className="pb-import">
                <div className="pb-import__head">
                  {preview.rows.length} valid row{preview.rows.length === 1 ? "" : "s"}
                  {preview.errors.length ? `, ${preview.errors.length} rejected` : ""}
                </div>
                {preview.errors.slice(0, 6).map((e) => (
                  <div key={e.line} className="pb-import__err pb-warn">LINE {e.line}: {e.reason}</div>
                ))}
                {preview.errors.length > 6 && <div className="pb-import__err pb-muted">and {preview.errors.length - 6} more</div>}
                <div className="pb-txform__row">
                  <Button variant="primary" disabled={!preview.rows.length} onClick={commitImport}>APPEND {preview.rows.length}</Button>
                  <Button onClick={() => setPreview(null)}>CANCEL</Button>
                </div>
              </div>
            )}
            {rejected.length > 0 && (
              <div className="pb-import__err pb-warn">
                {rejected.length} transaction{rejected.length === 1 ? " is" : "s are"} ignored by the
                accounting: {rejected[0].reason}.
              </div>
            )}
            <DataTable
              label="Transactions"
              columns={txColumns}
              rows={sortTransactions(transactions).slice().reverse()}
              rowKey={(t) => t.id}
              numbered={!isMobile}
              navigable
              className="pb-port__tx"
              empty="NO TRANSACTIONS"
            />
            <div className="pb-form__hint pb-muted">
              CSV columns: date,symbol,side,shares,price,fees. Import appends rather than
              replacing, and bad rows are listed with their line number.
            </div>
          </Section>
        </>
      )}

      {tab === "allocation" && (
        <Grid cols="1fr 1fr" colsMobile="1fr">
          <Section title="By holding" meta={`${byHolding.length}`}>
            <AllocationList rows={byHolding} label="Allocation by holding" />
          </Section>
          <Section title="By sector" meta="from company profiles">
            <AllocationList rows={bySector} label="Allocation by sector" />
            <div className="pb-form__hint pb-muted">
              Sector comes from each company profile; a name without one lands in UNKNOWN.
            </div>
          </Section>
        </Grid>
      )}

      {tab === "risk" && (
        <Section
          title="Risk"
          meta={risk ? `${risk.n} days, rf ${fmtNum(rf * 100, 2)}%` : null}
        >
          {!risk ? (
            <EmptyState>
              RISK NEEDS AT LEAST {MIN_RISK_POINTS} DAILY RETURNS. THIS PORTFOLIO HAS{" "}
              {series ? series.returns.length : 0}. ADD EARLIER TRANSACTIONS OR WAIT FOR MORE
              SESSIONS.
            </EmptyState>
          ) : (
            <KVList>
              <KV k="ANNUALISED VOLATILITY" v={`${fmtNum(risk.vol * 100, 1)}%`} />
              <KV
                k="MAX DRAWDOWN"
                v={risk.maxDrawdown < 0
                  ? <span className="pb-down">{fmtNum(risk.maxDrawdown * 100, 1)}%</span>
                  : "0.0%"}
              />
              <KV k="BEST DAY" v={<span className="pb-up">{fmtPct(risk.best * 100)}</span>} />
              <KV k="WORST DAY" v={<span className="pb-down">{fmtPct(risk.worst * 100)}</span>} />
              {/* VaR is a loss, so it reads positive. A negative one means the
                  5th-percentile day was itself a gain, which is worth saying
                  rather than printing as "-0.42%". */}
              <KV
                k="1-DAY 95% VAR"
                v={risk.var95 > 0 ? `${fmtNum(risk.var95 * 100, 2)}%` : "NO LOSS AT THE 5TH PERCENTILE"}
              />
              <KV k="SHARPE" v={risk.sharpe == null ? "—" : fmtNum(risk.sharpe, 2)} />
              <KV k="BETA TO S&P 500" v={portBeta == null ? "—" : fmtNum(portBeta, 2)} />
            </KVList>
          )}
          <div className="pb-form__hint pb-muted">
            Measured on the daily Dietz series above, not on the holdings as they stand today.
            Volatility is the standard deviation of daily returns times the square root of 252.
            Sharpe uses the 3-month bill as the risk-free rate (rf).
          </div>
        </Section>
      )}
    </Page>
  );
}
