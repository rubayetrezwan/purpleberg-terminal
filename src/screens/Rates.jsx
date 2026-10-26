import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { RefreshCw } from "lucide-react";
import { BOND_SYMBOLS } from "../config.js";
import { fmt, fmtSigned } from "../lib/format.js";
import { niceTicks } from "../lib/axis.js";
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

// A spread in basis points, signed and written like the monitor's CHG
// column: "+33bp", "-12bp".
const spread = (a, b) => (a != null && b != null ? `${fmtSigned((a - b) * 100, 0)}bp` : "—");

function CurveTab() {
  const { data, loading, updatedAt, intervalMs } = useQuotes(bondSymbols, 60000);
  const { colors, gridProps, axisProps, tooltipProps, areaProps } = useChartTheme();
  const isMobile = useIsMobile(768);

  const bySym = new Map(data.map((d) => [d.symbol, d]));
  // A tenor with no yield stays in the series as a null so the line breaks
  // there. Filtering it out would draw a smooth 3M-to-10Y curve straight
  // through the gap, which is a shape the market never quoted.
  const curve = BOND_SYMBOLS.map((b) => {
    const q = bySym.get(b.symbol);
    return { tenor: b.tenor, yield: q && q.price > 0 ? q.price : null };
  });
  const curvePoints = curve.filter((r) => r.yield != null).length;
  // Scaled to the yields with a margin either side, not pinned at zero: a
  // 4.0-5.3% curve on a 0-8% axis drew as a flat line.
  const yields = curve.map((r) => r.yield).filter((v) => v != null);
  const pad = yields.length ? Math.max((Math.max(...yields) - Math.min(...yields)) * 0.15, 0.1) : 0;
  const scale = yields.length ? niceTicks([Math.min(...yields) - pad, Math.max(...yields) + pad], 5) : null;

  const y = (sym) => {
    const q = bySym.get(sym);
    return q && q.price > 0 ? q.price : null;
  };
  const y3m = y("^IRX");
  const y5 = y("^FVX");
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
      <Section className="pb-rates__curve" title="US treasury yield curve" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />}>
        <ChartFrame height="fill" minHeight={isMobile ? 220 : 280} loading={loading && !curvePoints} empty={!loading && !curvePoints ? "NO YIELD DATA" : null}>
          {/* The right margin keeps the 30Y label clear of the plot edge. */}
          <AreaChart data={curve} margin={{ top: 8, right: 24, bottom: 0, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="tenor" {...axisProps} />
            <YAxis
              {...axisProps}
              domain={scale ? scale.domain : ["auto", "auto"]}
              ticks={scale ? scale.ticks : undefined}
              width={48}
              tickFormatter={(v) => `${fmt(v, scale ? scale.decimals : 1)}%`}
            />
            <Tooltip {...tooltipProps} formatter={(v) => `${fmt(v)}%`} />
            <Area dataKey="yield" name="YIELD" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
          </AreaChart>
        </ChartFrame>
      </Section>

      <Grid cols="1fr 1fr" colsMobile="1fr">
        <Section title="Treasury monitor" flush>
          <DataTable label="Treasury yields" columns={bondColumns} rows={bondRows} rowKey={(r) => r.symbol} numbered empty="NO DATA" />
        </Section>
        {/* Spreads only: the yields themselves are in the monitor beside it. */}
        <Section title="Spreads" meta="LONG MINUS SHORT">
          <KVList>
            <KV k="10Y-3M" v={spread(y10, y3m)} />
            <KV k="10Y-5Y" v={spread(y10, y5)} />
            <KV k="5Y-3M" v={spread(y5, y3m)} />
            <KV k="30Y-10Y" v={spread(y30, y10)} />
            <KV
              k="CURVE SHAPE"
              v={y10 != null && y3m != null ? <Tag tone={y10 > y3m ? undefined : "warn"}>{y10 > y3m ? "NORMAL" : "INVERTED"}</Tag> : "—"}
            />
          </KVList>
        </Section>
      </Grid>
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
  // The proxy answers 503 when the feed is down and it has no copy to serve:
  // that is not the same as a quiet week, and the empty state says which.
  const [failed, setFailed] = useState(false);

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
        setFailed(false);
      })
      .catch(() => setFailed(true))
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

  // The feed has no actuals today; a column that is always a dash is noise.
  const hasActual = events.some((e) => e.actual && e.actual !== "—");
  const emptyMsg = failed ? "CALENDAR FEED UNAVAILABLE. RETRYING EVERY 2 MIN." : "NO EVENTS IN THE CURRENT WINDOW";

  const columns = [
    { key: "date", label: "DATE", align: "left", render: (r) => <span className="pb-muted">{r.date}</span> },
    { key: "time", label: "TIME", align: "left", render: (r) => r.time },
    { key: "country", label: "CCY", align: "left", render: (r) => <Tag>{r.country}</Tag> },
    { key: "event", label: "EVENT", align: "left", render: (r) => r.event },
    hasActual && { key: "actual", label: "ACTUAL", render: (r) => (r.actual && r.actual !== "—" ? <span className="pb-eq__sym">{r.actual}</span> : "—") },
    { key: "forecast", label: "FORECAST", render: (r) => <span className="pb-muted">{r.forecast}</span> },
    { key: "previous", label: "PREVIOUS", render: (r) => <span className="pb-muted">{r.previous}</span> },
    { key: "impact", label: "IMPACT", render: (r) => <Tag tone={r.impact === "high" ? "warn" : undefined}>{(r.impact || "med").toUpperCase()}</Tag> },
  ].filter(Boolean);

  const meta = <><span>{rows.length} EVENTS · TIMES ET</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={120_000} /></>;

  // On a phone the head row cannot hold the title, the count and the
  // controls: the title was squeezed to "ECO ECO…". The count moves to its
  // own line under the head and the title shortens.
  return (
    <Section
      mnemonic="ECO"
      title={isMobile ? "Calendar" : "Economic calendar"}
      meta={isMobile ? null : meta}
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
      {isMobile && <div className="pb-econ__meta pb-label">{meta}</div>}
      {isMobile ? (
        loading && !rows.length ? <EmptyState>LOADING…</EmptyState> : !rows.length ? <EmptyState>{emptyMsg}</EmptyState> : (
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
                  {hasActual && <span>ACT {e.actual}</span>}
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
          empty={emptyMsg}
        />
      )}
    </Section>
  );
}

export default function Rates() {
  const { query } = useRoute();
  const tab = query.tab === "calendar" ? "calendar" : "curve";
  return (
    // The curve tab's chart takes the height left over, so the page's own
    // filler underneath is switched off there.
    <Page className={tab === "curve" ? "pb-rates pb-rates--curve" : "pb-rates"}>
      <Tabs label="Rates views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "curve" ? null : v })} />
      {tab === "curve" ? <CurveTab /> : <CalendarTab />}
    </Page>
  );
}
