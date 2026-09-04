import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Trash2 } from "lucide-react";
import { useRoute, updateQuery } from "../router/index.jsx";
import { api } from "../data/api.js";
import { useQuotes, useHistorical, useIsMobile } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import {
  portfolio, migratePortfolio, replaceTransactions, addTransaction,
  appendTransactions, removeTransaction,
} from "../stores/portfolio.js";
import {
  positionsFrom, enrichPositions, portfolioTotals, allocation, valueSeries,
  flowsByDate, alignFlows, dietzSeries, normalizeTo100, riskMetrics, beta,
  sortTransactions, toCsv, parseCsv, sampleTransactions, MIN_RISK_POINTS,
} from "../lib/portfolio.js";
import { fmtNum, fmtPct, fmtSigned, fmtAxisDate, fmtTooltipDate } from "../lib/format.js";
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

// One-time cutover from the pre-redesign holdings list. Only runs while the
// transaction store is empty, so nothing entered since is overwritten.
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
        body: "Each old holding became one buy dated today. Edit the dates on the transactions tab for accurate returns.",
        ttlMs: 9000,
      });
    }
  }, []);
}

// Daily closes for several symbols at once. The proxy caches per symbol, so
// re-fetching on a holdings change is cheap.
function useHistories(symbols, range = "1y") {
  const [state, setState] = useState({ bySymbol: {}, loading: symbols.length > 0 });
  const key = symbols.join(",");
  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) { setState({ bySymbol: {}, loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    Promise.all(
      list.map((s) => api.historical(s, range, "1d").then((rows) => [s, Array.isArray(rows) ? rows : []]).catch(() => [s, []]))
    ).then((pairs) => {
      if (!cancelled) setState({ bySymbol: Object.fromEntries(pairs), loading: false });
    });
    return () => { cancelled = true; };
  }, [key, range]);
  return state;
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
  useMigration();

  const transactions = useStore(portfolio, (s) => s.transactions);
  const { positions, rejected } = useMemo(() => positionsFrom(transactions), [transactions]);
  const openSymbols = useMemo(
    () => positions.filter((p) => p.shares > 0).map((p) => p.symbol).sort(),
    [positions]
  );
  const quoteSymbols = useMemo(() => [...openSymbols, BENCH, BILL], [openSymbols]);
  const { data: quotes, updatedAt, intervalMs } = useQuotes(quoteSymbols, 15000);
  const bySymbol = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);

  const rows = useMemo(() => enrichPositions(positions, bySymbol), [positions, bySymbol]);
  const openRows = useMemo(() => rows.filter((r) => r.shares > 0), [rows]);
  const totals = useMemo(() => portfolioTotals(rows), [rows]);

  // ── Performance ──
  const { data: benchRows, loading: benchLoading } = useHistorical(BENCH, "1y");
  const { bySymbol: closes, loading: closesLoading } = useHistories(openSymbols, "1y");
  const accepted = useMemo(() => {
    const bad = new Set(rejected.map((r) => r.transaction && r.transaction.id));
    return transactions.filter((t) => !bad.has(t.id));
  }, [transactions, rejected]);

  const series = useMemo(() => {
    const benchDates = (benchRows || []).filter((r) => Number(r.close) > 0);
    if (!benchDates.length || !accepted.length) return null;
    const first = sortTransactions(accepted)[0].date;
    const at = benchDates.findIndex((r) => r.date >= first);
    if (at < 0) return null;
    // Start one session before the first trade so the opening day's move is
    // measured from cost rather than being swallowed by the index base.
    const window = benchDates.slice(Math.max(0, at - 1));
    const dates = window.map((r) => r.date);
    const values = valueSeries(accepted, closes, dates);
    const { returns, index } = dietzSeries(values, alignFlows(flowsByDate(accepted), dates));
    const benchIndex = normalizeTo100(window);
    const benchByDate = new Map(benchIndex.map((r) => [r.date, r.value]));
    const benchReturns = window.slice(1).map((r, i) => ({
      date: r.date,
      r: Number(window[i].close) > 0 ? Number(r.close) / Number(window[i].close) - 1 : 0,
    }));
    const chart = index.map((p) => ({ date: p.date, port: p.value, bench: benchByDate.get(p.date) ?? null }));
    const last = index.length ? index[index.length - 1].value : null;
    const lastBench = benchIndex.length ? benchIndex[benchIndex.length - 1].value : null;
    return {
      chart, returns, index, benchReturns,
      portPct: last == null ? null : last - 100,
      benchPct: lastBench == null ? null : lastBench - 100,
      from: dates[0],
      days: dates.length,
    };
  }, [benchRows, closes, accepted]);

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

  // Shares of a symbol held on a date, for the form's sell check.
  const sharesHeld = (symbol, date) =>
    sortTransactions(accepted)
      .filter((t) => t.symbol === symbol && t.date <= date)
      .reduce((a, t) => a + (t.side === "sell" ? -Number(t.shares) : Number(t.shares)), 0);

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

  if (!transactions.length) {
    return (
      <Page>
        <Section mnemonic="PORT" title="Portfolio">
          <EmptyState>
            NO TRANSACTIONS. ADD TRADES ON THE TRANSACTIONS TAB, IMPORT A CSV, OR LOAD THE
            SAMPLE PORTFOLIO. EVERYTHING STAYS IN THIS BROWSER.
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
  const totalPnl = totals.unrealised == null ? totals.realised : totals.unrealised + totals.realised;

  const holdingColumns = [
    { key: "symbol", label: "SYMBOL", align: "left", render: (r) => <Ticker symbol={r.symbol} name={r.name} /> },
    { key: "shares", label: "SHARES", render: (r) => shareStr(r.shares) },
    { key: "avgCost", label: "AVG COST", render: (r) => money(r.avgCost) },
    { key: "price", label: "LAST", sortValue: (r) => r.price, render: (r) => (r.price == null ? <Tag tone="warn">NO QUOTE</Tag> : <Price value={r.price} format={(v) => fmtNum(v)} />) },
    { key: "chg", label: "CHG", sortValue: (r) => r.changePercent, render: (r) => <Change value={r.changePercent} /> },
    { key: "dayPnl", label: "DAY P&L", sortValue: (r) => r.dayPnl, render: (r) => <span className={r.dayPnl == null ? "" : `pb-${tone(r.dayPnl) || "muted"}`}>{moneySigned(r.dayPnl)}</span> },
    { key: "value", label: "VALUE", sortValue: (r) => r.value, render: (r) => money(r.value, 0) },
    { key: "unrealised", label: "UNREAL P&L", sortValue: (r) => r.unrealised, render: (r) => <span className={r.unrealised == null ? "" : `pb-${tone(r.unrealised) || "muted"}`}>{moneySigned(r.unrealised, 0)}</span> },
    { key: "unrealisedPct", label: "RETURN", sortValue: (r) => r.unrealisedPct, render: (r) => <Change value={r.unrealisedPct} /> },
    { key: "weight", label: "WEIGHT", sortValue: (r) => (r.live && totals.value > 0 ? (r.value / totals.value) * 100 : null), render: (r) => (r.live && totals.value > 0 ? `${fmtNum((r.value / totals.value) * 100, 1)}%` : "—") },
  ];

  const txColumns = [
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
        <Button size="sm" onClick={() => removeTransaction(t.id)} aria-label={`Delete the ${t.date} ${t.symbol} ${t.side}`}>
          <Trash2 size={11} strokeWidth={1.5} />
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <Section
        mnemonic="PORT"
        title="Portfolio"
        meta={<><span>{totals.holdings} holdings, {transactions.length} transactions{staleNote ? `, ${staleNote}` : ""}</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></>}
      >
        <StatRow cols={isMobile ? "1fr 1fr" : "repeat(5, 1fr)"}>
          <Stat label="VALUE" value={money(totals.value, 0)} size="lg" />
          <Stat label="DAY P&L" value={moneySigned(totals.dayPnl, 0)} tone={tone(totals.dayPnl)} size="lg" />
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
        meta={series ? `time-weighted, ${series.days} sessions from ${series.from}` : "since the first transaction"}
      >
        <ChartFrame
          height={isMobile ? 200 : 260}
          loading={(benchLoading || closesLoading) && !series}
          empty={!series || series.chart.length < 2 ? "NOT ENOUGH HISTORY YET" : null}
        >
          <LineChart data={series ? series.chart : []}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={(d) => fmtAxisDate(d, false)} minTickGap={40} />
            <YAxis {...axisProps} width={44} domain={["auto", "auto"]} tickFormatter={(v) => fmtNum(v, 0)} />
            <Tooltip {...tooltipProps} labelFormatter={fmtTooltipDate} formatter={(v, n) => [fmtNum(v, 1), n]} />
            <Legend wrapperStyle={{ fontSize: 10, color: colors.muted }} />
            <Line dataKey="port" name="PORTFOLIO" stroke={colors.series[0]} {...lineProps} />
            <Line dataKey="bench" name="S&P 500" stroke={colors.series[2]} {...lineProps} strokeDasharray="3 3" connectNulls />
          </LineChart>
        </ChartFrame>
        <div className="pb-form__hint pb-muted">
          Both lines start at 100. The portfolio line is a daily Dietz chain, so deposits and
          withdrawals do not count as gains.
        </div>
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
            <TransactionForm sharesHeld={sharesHeld} onAdd={(t) => { addTransaction(t); toast({ title: `${t.side.toUpperCase()} ${t.symbol} RECORDED` }); }} />
          </Section>

          <Section
            title="Transactions"
            meta={`${transactions.length}`}
            actions={
              <>
                <Button size="sm" onClick={doExport}>EXPORT CSV</Button>
                <Button size="sm" onClick={() => fileRef.current && fileRef.current.click()}>IMPORT CSV</Button>
                <input ref={fileRef} type="file" accept="text/csv,.csv,.txt" className="pb-sr-only" onChange={(e) => doImport(e.target.files && e.target.files[0])} aria-label="Import transactions CSV" />
                <Button size="sm" variant="danger" onClick={doClear}>CLEAR</Button>
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
              numbered
              navigable
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
          meta={risk ? `${risk.n} daily returns, risk-free ${fmtNum(rf * 100, 2)}% from the 3-month bill` : null}
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
              <KV k="MAX DRAWDOWN" v={<span className="pb-down">{fmtNum(risk.maxDrawdown * 100, 1)}%</span>} />
              <KV k="BEST DAY" v={<span className="pb-up">{fmtPct(risk.best * 100)}</span>} />
              <KV k="WORST DAY" v={<span className="pb-down">{fmtPct(risk.worst * 100)}</span>} />
              <KV k="1-DAY 95% VAR" v={`${fmtNum(risk.var95 * 100, 2)}%`} />
              <KV k="SHARPE" v={risk.sharpe == null ? "—" : fmtNum(risk.sharpe, 2)} />
              <KV k="BETA TO S&P 500" v={portBeta == null ? "—" : fmtNum(portBeta, 2)} />
            </KVList>
          )}
          <div className="pb-form__hint pb-muted">
            Measured on the daily Dietz series above, not on the holdings as they stand today.
            Volatility is the standard deviation of daily returns times the square root of 252.
          </div>
        </Section>
      )}
    </Page>
  );
}
