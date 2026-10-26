import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, LineChart, Line, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { fmtK, fmtNum, fmtPct, fmtAxisDate, fmtTooltipDate, MONTHS_SHORT } from "../lib/format.js";
import { niceTicks, monthTicks, thinForDrawing } from "../lib/axis.js";
import { periodReturns, CALENDAR_DAY_OFFSETS } from "../lib/returns.js";
import { useRoute, updateQuery, navigate, pathFor } from "../router/index.jsx";
import { useCryptoMarkets, useCryptoChart, useIsMobile } from "../data/hooks.js";
import { ListDetail } from "../ui/ListDetail.jsx";
import { Section } from "../ui/Section.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { Tabs } from "../ui/Tabs.jsx";
import { Stat, StatRow } from "../ui/Stat.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Tag } from "../ui/Tag.jsx";
import { RangeBar } from "../ui/RangeBar.jsx";
import { PeriodReturns } from "../ui/PeriodReturns.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { ChartFrame, useChartTheme } from "../ui/ChartFrame.jsx";

const TABS = ["CHART", "STATS", "ABOUT"];
const RANGES = ["1mo", "3mo", "6mo", "1y", "max"];
const TYPES = [{ value: "area", label: "AREA" }, { value: "line", label: "LINE" }, { value: "volume", label: "VOLUME" }];

// Market-cap tier, used only as a label; CoinGecko ranks the whole universe
// while this screen shows the top 20.
function tierFor(rank) {
  if (!rank) return "ALT";
  if (rank <= 2) return "MAJOR";
  if (rank <= 10) return "LARGE CAP";
  return "MID CAP";
}

// Crypto prices span ten orders of magnitude, so precision follows magnitude:
// a SHIB tick must not render as 0.00. Everything from a cent to $10 gets four
// places, so the stablecoins line up: USDS read "1.00" next to USDC "0.9996".
function decimalsFor(price) {
  const p = Math.abs(Number(price));
  if (!(p > 0)) return 2;
  if (p >= 1000) return 0;
  if (p >= 10) return 2;
  if (p >= 0.01) return 4;
  if (p >= 0.0001) return 6;
  return 8;
}
function coinPrice(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const d = decimalsFor(v);
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
// Room for the last date label, which is centred on the final point and was
// cut to "Oct" at the plot's right edge.
const CHART_MARGIN = { top: 8, right: 24, bottom: 0, left: 4 };

function athDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Crypto() {
  const { params, query } = useRoute();
  const tab = TABS.includes((query.tab || "").toUpperCase()) ? query.tab.toUpperCase() : "CHART";
  const range = RANGES.includes(query.range) ? query.range : "3mo";
  const type = TYPES.some((t) => t.value === query.type) ? query.type : "area";
  const { data: coins, loading, error, updatedAt, intervalMs } = useCryptoMarkets();
  const isMobile = useIsMobile(768);
  const { colors, gridProps, axisProps, tooltipProps, lineProps, areaProps } = useChartTheme();

  // CoinGecko and CoinPaprika use different id schemes ("bitcoin" versus
  // "paprika:btc-bitcoin"), so remember which symbol the URL resolved to:
  // when the proxy fails over mid-session an id-only lookup would reset the
  // selection. The command line passes what was typed, lowercased ("CRYP ETH"
  // arrives as "eth"), so an id, a ticker or a name all match, in any case.
  const [last, setLast] = useState(null);
  const requested = params.id || null;
  const key = requested ? requested.toLowerCase() : null;
  const matched = key
    ? coins.find((c) => [c.id, c.symbol, c.name].some((v) => String(v || "").toLowerCase() === key))
    : null;
  const remembered = last && (!requested || last.requested === requested)
    ? coins.find((c) => c.symbol === last.symbol)
    : null;
  // A key that matches nothing in the top 20 says NOT FOUND instead of
  // showing BTC under a URL that names another coin. The first coin still
  // stands in for the values below; they are cheap and unused.
  const missing = Boolean(requested) && coins.length > 0 && !matched && !remembered;
  const selected = matched || remembered || coins[0] || null;

  useEffect(() => {
    if (!selected || missing) return;
    if (!last || last.symbol !== selected.symbol || last.requested !== requested) {
      setLast({ requested, symbol: selected.symbol });
    }
  }, [selected, missing, last, requested]);

  const id = selected && !missing ? selected.id : null;
  const { data: hist, loading: histLoading } = useCryptoChart(id, range);
  // The proxy sends every daily close (about 3,650 for MAX). Returns are
  // measured on that full series; only the drawing is thinned.
  const chartRows = useMemo(
    () => thinForDrawing(hist, 600).map((d) => ({ date: d.date || "", price: d.close, volume: d.volume })),
    [hist]
  );
  const returns = useMemo(() => periodReturns(hist, CALENDAR_DAY_OFFSETS), [hist]);
  const showYear = range === "1y" || range === "max";
  const scale = useMemo(() => niceTicks(chartRows.map((r) => r.price), isMobile ? 5 : 6), [chartRows, isMobile]);
  // One precision for the whole axis, from the tick step: MAX printed "$0.00"
  // under "$1,500" when each tick chose its own decimals.
  const yAxis = {
    ...axisProps,
    domain: scale ? scale.domain : ["auto", "auto"],
    ticks: scale ? scale.ticks : undefined,
    width: 72,
    tickFormatter: (v) => `$${fmtNum(v, scale ? scale.decimals : 2)}`,
  };
  // Multi-year axes label month starts, once each; shorter ranges label days.
  const xTicks = showYear ? monthTicks(chartRows.map((r) => r.date), isMobile ? 6 : 12) : undefined;
  const xAxis = {
    ...axisProps,
    dataKey: "date",
    ticks: xTicks,
    interval: xTicks ? 0 : Math.max(1, Math.floor(chartRows.length / (isMobile ? 6 : 12))),
    tickFormatter: (v) => fmtAxisDate(v, showYear),
    minTickGap: 20,
  };
  const tip = { ...tooltipProps, labelFormatter: fmtTooltipDate };

  const select = (nextId) => navigate(pathFor("crypto", { id: nextId }, query));

  if (loading && !coins.length) {
    return <Section title="Crypto"><EmptyState>LOADING TOP 20…</EmptyState></Section>;
  }
  if (!selected) {
    return (
      <Section mnemonic="CRYP" title="Crypto">
        <EmptyState>
          NO MARKETS LOADED. THE UPSTREAM (COINGECKO, WITH COINPAPRIKA FALLBACK) OR THIS PROXY
          MAY BE RATE-LIMITED. IT RETRIES AUTOMATICALLY.
        </EmptyState>
        {error && <div className="pb-form__hint pb-muted">LAST ERROR: {error}</div>}
      </Section>
    );
  }

  const tier = tierFor(selected.marketCapRank);
  const dp = decimalsFor(selected.price);
  const money = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : `$${coinPrice(v)}`);
  const athPct = selected.ath > 0 && selected.price > 0 ? (selected.price / selected.ath) * 100 : null;

  const listColumns = [
    // Clipped so LAST and 24H always fit beside a long symbol (FIGR_HELOC).
    { key: "name", label: "COIN", align: "left", render: (r) => <span className="pb-eq__sym pb-clip" style={{ "--clip": "10ch" }} title={r.symbol}>{r.symbol}</span> },
    { key: "price", label: "LAST", render: (r) => (r.price > 0 ? <Price value={r.price} format={(v) => coinPrice(v)} /> : "—") },
    { key: "changePercent24h", label: "24H", render: (r) => <Change value={r.changePercent24h} /> },
  ];

  const list = (
    <Section title="Top cryptos" meta={<Freshness updatedAt={updatedAt} intervalMs={intervalMs} />} flush>
      <DataTable
        label="Cryptocurrencies"
        columns={listColumns}
        rows={coins}
        rowKey={(r) => r.id}
        selectedKey={id}
        numbered
        navigable
        onRowClick={(r) => select(r.id)}
        empty="NO MARKETS"
      />
    </Section>
  );

  const detail = missing ? (
    <div className="pb-eq__detail pb-des">
      <EmptyState>COIN {requested.toUpperCase()} NOT FOUND IN TOP 20</EmptyState>
    </div>
  ) : (
    <div className="pb-eq__detail pb-des">
      <header className="pb-eq__head">
        <span className="pb-eq__symbig">{selected.name}</span>
        <span className="pb-eq__name pb-muted">{selected.symbol}</span>
        <Tag>{tier}</Tag>
        {selected.marketCapRank ? <Tag>RANK {selected.marketCapRank}</Tag> : null}
      </header>

      <StatRow>
        <Stat label="Last (USD)" value={money(selected.price)} size="lg" />
        <Stat label="24h chg" value={selected.changePercent24h == null ? "—" : fmtPct(selected.changePercent24h)} tone={selected.changePercent24h == null ? undefined : selected.changePercent24h >= 0 ? "up" : "down"} />
        <Stat label="24h hi" value={money(selected.high24h)} />
        <Stat label="24h lo" value={money(selected.low24h)} />
        <Stat label="24h vol" value={selected.volume24h > 0 ? `$${fmtK(selected.volume24h)}` : "—"} />
        <Stat label="Mkt cap" value={selected.marketCap > 0 ? `$${fmtK(selected.marketCap)}` : "—"} />
      </StatRow>

      <Tabs label="Crypto views" tabs={TABS} active={tab} onChange={(v) => updateQuery({ tab: v === "CHART" ? null : v })} />

      {tab === "CHART" && (
        <>
          <div className="pb-eq__toolbar">
            <Segmented size="sm" label="Chart type" value={type} onChange={(v) => updateQuery({ type: v === "area" ? null : v })} options={TYPES} />
            <Segmented size="sm" label="Range" value={range} onChange={(v) => updateQuery({ range: v === "3mo" ? null : v })} options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />
          </div>
          <ChartFrame height="fill" minHeight={isMobile ? 240 : 340} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? `NO HISTORY FOR ${String(selected.name).toUpperCase()}` : null}>
            {type === "line" ? (
              <LineChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis {...yAxis} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </LineChart>
            ) : type === "volume" ? (
              <ComposedChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis yAxisId="p" {...yAxis} />
                <YAxis yAxisId="v" orientation="right" {...axisProps} width={52} tickFormatter={(v) => `$${fmtK(v)}`} />
                <Tooltip {...tip} formatter={(v, n) => (n === "VOLUME" ? `$${fmtK(v)}` : money(v))} />
                <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartRows} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis {...xAxis} />
                <YAxis {...yAxis} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
              </AreaChart>
            )}
          </ChartFrame>
        </>
      )}

      {tab === "STATS" && (
        <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <Section title="Price action" meta="24H · ALL-TIME">
            <KVList cols={2}>
              <KV k="LAST" v={money(selected.price)} />
              <KV k="RANK" v={selected.marketCapRank ? `#${selected.marketCapRank}` : "—"} />
              <KV k="24H HI" v={money(selected.high24h)} />
              <KV k="24H LO" v={money(selected.low24h)} />
              <KV k="24H RANGE" v={selected.high24h > 0 && selected.low24h > 0 ? money(selected.high24h - selected.low24h) : "—"} />
              <KV k="24H VOL" v={selected.volume24h > 0 ? `$${fmtK(selected.volume24h)}` : "—"} />
              <KV k="MKT CAP" v={selected.marketCap > 0 ? `$${fmtK(selected.marketCap)}` : "—"} />
              <KV k="TIER" v={tier} />
            </KVList>
            {athPct != null && (
              <div className="pb-eq__rangewrap">
                <RangeBar pct={athPct} lo={money(selected.atl)} hi={money(selected.ath)} label="ATH" />
              </div>
            )}
          </Section>
          <Section title="Period returns" meta="CALENDAR DAYS">
            <PeriodReturns
              returns={returns}
              note="24/7 MARKET: OFFSETS 7 / 30 / 90 / 180 / 365 CALENDAR DAYS ON THE LOADED RANGE. YTD FROM LAST YEAR'S FINAL CLOSE, ONCE THE RANGE REACHES IT."
            />
          </Section>
        </div>
      )}

      {tab === "ABOUT" && (
        <Section title="Coin reference" meta={`${String(selected.name).toUpperCase()} · ${selected.symbol}`}>
          <KVList cols={2}>
            <KV k="SYMBOL" v={selected.symbol || "—"} />
            <KV k="TIER" v={tier} />
            <KV k="CIRCULATING" v={selected.circulatingSupply > 0 ? fmtK(selected.circulatingSupply) : "—"} />
            <KV k="TOTAL SUPPLY" v={selected.totalSupply > 0 ? fmtK(selected.totalSupply) : "—"} />
            <KV k="MAX SUPPLY" v={selected.maxSupply > 0 ? fmtK(selected.maxSupply) : "UNCAPPED"} />
            <KV k="ALL-TIME HIGH" v={`${money(selected.ath)}${athDate(selected.athDate) ? ` · ${athDate(selected.athDate)}` : ""}`} />
            <KV k="ALL-TIME LOW" v={`${money(selected.atl)}${athDate(selected.atlDate) ? ` · ${athDate(selected.atlDate)}` : ""}`} />
            <KV k="FROM ATH" v={<Change value={selected.athChangePercent} decimals={1} />} />
          </KVList>
          <div className="pb-form__hint pb-muted">
            SOURCE: COINGECKO VIA THIS PROXY; COINPAPRIKA WHEN COINGECKO RATE-LIMITS.
            24/7 MARKET: 24H FIGURES ROLL, NO EXCHANGE CLOSE.
          </div>
        </Section>
      )}
    </div>
  );

  // A native select shows its first option when the value matches none, so a
  // missing coin gets a placeholder rather than reading as BTC.
  const options = coins.map((c) => ({ value: c.id, label: `${c.symbol} · ${coinPrice(c.price)}` }));

  return (
    <ListDetail
      className="pb-mkt"
      listWidth={268}
      list={list}
      detail={detail}
      mobile={{
        label: "Cryptocurrency",
        value: missing ? "" : id,
        onChange: select,
        options: missing ? [{ value: "", label: `${requested.toUpperCase()} · NOT FOUND` }, ...options] : options,
      }}
    />
  );
}
