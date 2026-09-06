import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { RefreshCw } from "lucide-react";
import { BOND_SYMBOLS } from "../config.js";
import { fmt } from "../lib/format.js";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useQuotes, useIsMobile } from "../data/hooks.js";
import { api } from "../data/api.js";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Tabs } from "../ui/Tabs.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Button } from "../ui/Button.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

const TABS = [{ value: "curve", label: "CURVE" }, { value: "calendar", label: "CALENDAR" }];
const bondSymbols = BOND_SYMBOLS.map((b) => b.symbol);
const TREASURY_ROWS = [
  ["us3m", "3M", "US 3-month bill"],
  ["us5y", "5Y", "US 5-year note"],
  ["us10y", "10Y", "US 10-year note"],
  ["us30y", "30Y", "US 30-year bond"],
];

function CurveTab() {
  const { data, loading, updatedAt, intervalMs } = useQuotes(bondSymbols, 60000);
  const { colors, gridProps, axisProps, tooltipProps, areaProps } = useChartTheme();
  const isMobile = useIsMobile(768);
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = () => api.treasuryRates()
      .then((r) => { if (live) { setRates(r || {}); setRatesLoading(false); } })
      .catch(() => { if (live) setRatesLoading(false); });
    load();
    const iv = setInterval(load, 300_000);
    return () => { live = false; clearInterval(iv); };
  }, []);

  const bySym = new Map(data.map((d) => [d.symbol, d]));
  // A tenor with no yield stays in the series as a null so the line breaks
  // there. Filtering it out would draw a smooth 3M-to-10Y curve straight
  // through the gap, which is a shape the market never quoted.
  const curve = BOND_SYMBOLS.map((b) => {
    const q = bySym.get(b.symbol);
    return { tenor: b.tenor, yield: q && q.price > 0 ? q.price : null };
  });
  const curvePoints = curve.filter((r) => r.yield != null).length;

  const y = (sym) => {
    const q = bySym.get(sym);
    return q && q.price > 0 ? q.price : null;
  };
  const y3m = y("^IRX");
  const y10 = y("^TNX");
  const y30 = y("^TYX");

  const bondColumns = [
    { key: "tenor", label: "TENOR", align: "left", render: (r) => r.tenor },
    { key: "name", label: "INSTRUMENT", align: "left", render: (r) => <span className="pb-muted">{r.name}</span> },
    { key: "yield", label: "YIELD", render: (r) => (r.yield != null ? `${fmt(r.yield)}%` : "—") },
    // Yahoo reports the change in percentage points; a rates desk reads basis points.
    { key: "chg", label: "CHG", render: (r) => <Change value={r.chg == null ? null : r.chg * 100} suffix="bp" decimals={0} /> },
  ];
  const bondRows = BOND_SYMBOLS.map((b) => {
    const q = bySym.get(b.symbol);
    return { ...b, yield: q && q.price > 0 ? q.price : null, chg: q ? q.change : null };
  });

  return (
    <>
      <Section title="US treasury yield curve" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />}>
        <ChartFrame height={isMobile ? 220 : 280} loading={loading && !curvePoints} empty={!loading && !curvePoints ? "NO YIELD DATA" : null}>
          <AreaChart data={curve}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="tenor" {...axisProps} />
            <YAxis {...axisProps} domain={[0, "auto"]} width={48} tickFormatter={(v) => `${fmt(v, 1)}%`} />
            <Tooltip {...tooltipProps} formatter={(v) => `${fmt(v)}%`} />
            <Area dataKey="yield" name="YIELD" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
          </AreaChart>
        </ChartFrame>
      </Section>

      <Grid cols="1fr 1fr" colsMobile="1fr">
        <Section title="Treasury monitor" flush>
          <DataTable label="Treasury yields" columns={bondColumns} rows={bondRows} rowKey={(r) => r.symbol} numbered empty="NO DATA" />
        </Section>
        <Section title="Spreads">
          <KVList>
            <KV k="3M" v={y3m != null ? `${fmt(y3m)}%` : "—"} />
            <KV k="10Y" v={y10 != null ? `${fmt(y10)}%` : "—"} />
            <KV k="30Y" v={y30 != null ? `${fmt(y30)}%` : "—"} />
            <KV k="10Y-3M" v={y10 != null && y3m != null ? `${fmt((y10 - y3m) * 100, 0)} bp` : "—"} />
            <KV k="30Y-10Y" v={y30 != null && y10 != null ? `${fmt((y30 - y10) * 100, 0)} bp` : "—"} />
            <KV
              k="CURVE SHAPE"
              v={y10 != null && y3m != null ? <Tag tone={y10 > y3m ? undefined : "warn"}>{y10 > y3m ? "NORMAL" : "INVERTED"}</Tag> : "—"}
            />
          </KVList>
        </Section>
      </Grid>

      <Section title="Treasury rates endpoint" meta="server /api/treasury-rates" flush>
        <DataTable
          label="Treasury rates from the proxy"
          columns={[
            { key: "tenor", label: "TENOR", align: "left", render: (r) => r.tenor },
            { key: "name", label: "INSTRUMENT", align: "left", render: (r) => <span className="pb-muted">{r.name}</span> },
            { key: "value", label: "YIELD", render: (r) => (r.value == null ? "—" : `${fmt(r.value)}%`) },
            { key: "state", label: "STATE", render: (r) => (r.value == null ? <Tag tone="warn">NO DATA</Tag> : <Tag tone="up">OK</Tag>) },
          ]}
          rows={TREASURY_ROWS.map(([key, tenor, name]) => {
            // Coerce first: Number.isNaN("4.2") is false, so a stringified
            // yield would slip past a raw NaN check and throw on toFixed.
            const n = Number(rates[key]);
            return { key, tenor, name, value: rates[key] != null && rates[key] !== "" && Number.isFinite(n) && n > 0 ? n : null };
          })}
          rowKey={(r) => r.key}
          loading={ratesLoading}
          empty="NO DATA"
        />
      </Section>
    </>
  );
}

function CalendarTab() {
  const { query } = useRoute();
  const impact = query.impact === "high" ? "high" : "all";
  const isMobile = useIsMobile(768);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return api.econCalendar()
      .then((d) => {
        const rows = Array.isArray(d) ? d : [];
        setEvents(rows);
        // An empty answer means the scrape found nothing, which is not the
        // same as a calendar that is up to date and empty. Keep the old
        // timestamp so Freshness cannot read "2s ago" over nothing.
        if (rows.length) setUpdatedAt(Date.now());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let live = true;
    const run = () => { if (live) load(); };
    run();
    const iv = setInterval(run, 120_000);
    return () => { live = false; clearInterval(iv); };
  }, [load]);

  const rows = useMemo(
    () => (impact === "high" ? events.filter((e) => e.impact === "high") : events),
    [events, impact]
  );

  const columns = [
    { key: "date", label: "DATE", align: "left", render: (r) => <span className="pb-muted">{r.date}</span> },
    { key: "time", label: "TIME", align: "left", render: (r) => r.time },
    { key: "country", label: "CCY", align: "left", render: (r) => <Tag>{r.country}</Tag> },
    { key: "event", label: "EVENT", align: "left", render: (r) => r.event },
    { key: "actual", label: "ACTUAL", render: (r) => (r.actual && r.actual !== "—" ? <span className="pb-eq__sym">{r.actual}</span> : "—") },
    { key: "forecast", label: "FORECAST", render: (r) => <span className="pb-muted">{r.forecast}</span> },
    { key: "previous", label: "PREVIOUS", render: (r) => <span className="pb-muted">{r.previous}</span> },
    { key: "impact", label: "IMPACT", render: (r) => <Tag tone={r.impact === "high" ? "warn" : undefined}>{(r.impact || "med").toUpperCase()}</Tag> },
  ];

  return (
    <Section
      mnemonic="ECO"
      title="Economic calendar"
      meta={<><span>{rows.length} events, times ET</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={120_000} /></>}
      actions={
        <>
          <Segmented
            size="sm"
            label="Impact"
            value={impact}
            onChange={(v) => updateQuery({ impact: v === "all" ? null : v })}
            options={[{ value: "all", label: "ALL" }, { value: "high", label: "HIGH" }]}
          />
          <Button size="sm" onClick={load} aria-label="Refresh calendar"><RefreshCw size={11} strokeWidth={1.5} /></Button>
        </>
      }
      flush
    >
      {isMobile ? (
        loading && !rows.length ? <EmptyState>LOADING…</EmptyState> : !rows.length ? <EmptyState>NO EVENTS</EmptyState> : (
          <ol className="pb-econ">
            {rows.map((e, i) => (
              <li key={`${e.date}-${e.time}-${e.country}-${e.event}-${i}`} className="pb-econ__row">
                <div className="pb-econ__head">
                  <span className="pb-muted">{i + 1})</span>
                  <Tag>{e.country}</Tag>
                  <Tag tone={e.impact === "high" ? "warn" : undefined}>{(e.impact || "med").toUpperCase()}</Tag>
                  <span className="pb-muted pb-econ__when">{e.date} {e.time}</span>
                </div>
                <div className="pb-econ__event">{e.event}</div>
                <div className="pb-econ__vals">
                  <span>ACT {e.actual}</span>
                  <span className="pb-muted">FCST {e.forecast}</span>
                  <span className="pb-muted">PREV {e.previous}</span>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : (
        <DataTable
          label="Economic events"
          columns={columns}
          rows={rows}
          rowKey={(r, i) => `${r.date}-${r.time}-${r.country}-${r.event}-${i}`}
          numbered
          loading={loading && !rows.length}
          empty="NO EVENTS IN THE CURRENT WINDOW"
        />
      )}
    </Section>
  );
}

export default function Rates() {
  const { query } = useRoute();
  const tab = query.tab === "calendar" ? "calendar" : "curve";
  return (
    <Page>
      <Tabs label="Rates views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "curve" ? null : v })} />
      {tab === "curve" ? <CurveTab /> : <CalendarTab />}
    </Page>
  );
}
