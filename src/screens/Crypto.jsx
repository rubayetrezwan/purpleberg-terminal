import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, LineChart, Line, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { fmtK, fmtPct, fmtAxisDate, fmtTooltipDate, MONTHS_SHORT } from "../lib/format.js";
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
// a SHIB tick must not render as 0.00.
function decimalsFor(price) {
  const p = Math.abs(Number(price));
  if (!(p > 0)) return 2;
  if (p >= 1000) return 0;
  if (p >= 1) return 2;
  if (p >= 0.01) return 4;
  if (p >= 0.0001) return 6;
  return 8;
}
function coinPrice(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const d = decimalsFor(v);
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
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
  // "paprika:btc-bitcoin"), so keep the symbol as a fallback key: when the
  // proxy fails over mid-session an id-only lookup would reset the selection.
  const [lastSymbol, setLastSymbol] = useState(null);
  const requested = params.id || null;
  const selected =
    (requested && coins.find((c) => c.id === requested)) ||
    (lastSymbol ? coins.find((c) => c.symbol === lastSymbol) : null) ||
    coins[0] ||
    null;

  useEffect(() => {
    if (selected && selected.symbol !== lastSymbol) setLastSymbol(selected.symbol);
  }, [selected, lastSymbol]);

  const id = selected ? selected.id : null;
  const { data: hist, loading: histLoading } = useCryptoChart(id, range);
  const chartRows = useMemo(() => hist.map((d) => ({ date: d.date || "", price: d.close, volume: d.volume })), [hist]);
  const returns = useMemo(() => periodReturns(hist, CALENDAR_DAY_OFFSETS), [hist]);
  const showYear = range === "1y" || range === "max";
  const interval = Math.max(1, Math.floor(chartRows.length / (isMobile ? 6 : 12)));
  const axis = { ...axisProps, tick: { ...axisProps.tick, fontSize: 9 } };
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
        {error && <div className="pb-form__hint pb-muted">Last error: {error}</div>}
      </Section>
    );
  }

  const tier = tierFor(selected.marketCapRank);
  const dp = decimalsFor(selected.price);
  const money = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : `$${coinPrice(v)}`);
  const athPct = selected.ath > 0 && selected.price > 0 ? (selected.price / selected.ath) * 100 : null;

  const listColumns = [
    { key: "name", label: "COIN", align: "left", render: (r) => <span className="pb-eq__sym">{r.symbol}</span> },
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

  const detail = (
    <div className="pb-eq__detail">
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
          <ChartFrame height={isMobile ? 240 : 340} loading={histLoading && !chartRows.length} empty={!histLoading && !chartRows.length ? `NO HISTORY FOR ${selected.name}` : null}>
            {type === "line" ? (
              <LineChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis {...axis} domain={["auto", "auto"]} width={72} tickFormatter={(v) => money(v)} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Line dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </LineChart>
            ) : type === "volume" ? (
              <ComposedChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis yAxisId="p" {...axis} domain={["auto", "auto"]} width={72} tickFormatter={(v) => money(v)} />
                <YAxis yAxisId="v" orientation="right" {...axis} width={52} tickFormatter={(v) => `$${fmtK(v)}`} />
                <Tooltip {...tip} formatter={(v, n) => (n === "VOLUME" ? `$${fmtK(v)}` : money(v))} />
                <Bar yAxisId="v" dataKey="volume" name="VOLUME" fill={colors.series[2]} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="price" name="CLOSE" stroke={colors.series[0]} {...lineProps} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartRows}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axis} interval={interval} tickFormatter={(v) => fmtAxisDate(v, showYear)} minTickGap={20} />
                <YAxis {...axis} domain={["auto", "auto"]} width={72} tickFormatter={(v) => money(v)} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Area dataKey="price" name="CLOSE" stroke={colors.series[0]} fill={colors.series[0]} {...areaProps} />
              </AreaChart>
            )}
          </ChartFrame>
        </>
      )}

      {tab === "STATS" && (
        <div className="pb-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <Section title="Price action" meta="24h session and all-time">
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
          <Section title="Period returns" meta="calendar-day offsets">
            <PeriodReturns
              returns={returns}
              note="Crypto trades continuously, so offsets are 7, 30, 90, 180, and 365 calendar days from the loaded window. YTD measures from last year's final close and only appears once the range reaches back that far."
            />
          </Section>
        </div>
      )}

      {tab === "ABOUT" && (
        <Section title="Coin reference" meta={`${selected.name} (${selected.symbol})`}>
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
            Prices, supply, and all-time levels come from the CoinGecko public API through this
            proxy, with CoinPaprika as an automatic fallback when CoinGecko rate-limits the
            deploy IP. Crypto trades 24/7, so the 24h figures roll continuously rather than
            resetting at an exchange close.
          </div>
        </Section>
      )}
    </div>
  );

  return (
    <ListDetail
      listWidth={200}
      list={list}
      detail={detail}
      mobile={{
        label: "Cryptocurrency",
        value: id,
        onChange: select,
        options: coins.map((c) => ({ value: c.id, label: `${c.symbol} · ${coinPrice(c.price)}` })),
      }}
    />
  );
}
