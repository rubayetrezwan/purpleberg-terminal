import { useMemo } from "react";
import { Rocket, CalendarClock, Info } from "lucide-react";
import { IPO_2026, IPO_2026_LISTED_TICKERS, fmt, fmtK } from "../config";
import { useColors } from "../ThemeContext";
import { useQuotes, useIpoCalendar, useIsMobile } from "../hooks";
import { mergeLiveQuotes, ipoMarketValue } from "../ipoUtils";
import { Panel, PanelHeader, Badge, ChgVal, LoadingSpinner } from "../shared";

const usd = (n) => (n > 0 ? "$" + fmtK(n) : "—");

const STATUS_COLOR = (COLORS) => ({
  listed: COLORS.green,
  priced: COLORS.green,
  expected: COLORS.orange,
  filed: COLORS.blue,
  withdrawn: COLORS.red,
});

export default function IpoCenter() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);

  // Live quotes for the curated names that are already trading.
  const { data: quotes } = useQuotes(IPO_2026_LISTED_TICKERS, 15000);
  const rows = useMemo(() => mergeLiveQuotes(IPO_2026, quotes), [quotes]);

  // Live recent/upcoming IPO calendar (Finnhub via proxy).
  const { events, configured, loading: calLoading } = useIpoCalendar();

  const statusColor = STATUS_COLOR(COLORS);
  const th = {
    padding: "6px 8px", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap",
  };
  const td = { padding: "7px 8px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" };
  const mono = { fontFamily: "'JetBrains Mono',monospace" };

  return (
    <div style={{ padding: isMobile ? 8 : 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── CURATED TOP 10 ── */}
      <Panel>
        <PanelHeader
          icon={<Rocket size={14} color={COLORS.purple} />}
          title="TOP IPOs OF 2026"
          subtitle="Curated from public reporting · live price/cap via Yahoo for listed names"
          right={<Badge color={COLORS.purpleLight}>{rows.length} TRACKED</Badge>}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>#</th>
                <th style={{ ...th, textAlign: "left" }}>Company</th>
                <th style={{ ...th, textAlign: "left" }}>Ticker</th>
                {!isMobile && <th style={{ ...th, textAlign: "left" }}>IPO Date</th>}
                {!isMobile && <th style={{ ...th, textAlign: "right" }}>Raised</th>}
                <th style={{ ...th, textAlign: "right" }}>Price</th>
                {!isMobile && <th style={{ ...th, textAlign: "right" }}>Chg</th>}
                <th style={{ ...th, textAlign: "right" }}>Valuation</th>
                <th style={{ ...th, textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const q = r.quote;
                const val = ipoMarketValue(r);
                return (
                  <tr key={r.rank} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ ...td, color: COLORS.textMuted }}>{r.rank}</td>
                    <td style={{ ...td, fontFamily: "inherit" }}>
                      <div style={{ fontWeight: 700, color: COLORS.text }}>{r.company}</div>
                      <div style={{ fontSize: 9, color: COLORS.textMuted }}>{r.sector}</div>
                    </td>
                    <td style={td}>
                      {r.ticker
                        ? <span style={{ color: COLORS.purpleLight, fontWeight: 700 }}>{r.ticker}</span>
                        : <span style={{ color: COLORS.textDim }}>{"—"}</span>}
                    </td>
                    {!isMobile && <td style={{ ...td, color: COLORS.textDim, fontFamily: "inherit", fontSize: 10 }}>{r.date}</td>}
                    {!isMobile && <td style={{ ...td, textAlign: "right", color: COLORS.textDim }}>{usd(r.raised)}</td>}
                    <td style={{ ...td, textAlign: "right", color: COLORS.text }}>{q && q.price > 0 ? fmt(q.price) : "—"}</td>
                    {!isMobile && (
                      <td style={{ ...td, textAlign: "right" }}>
                        {q && q.price > 0 ? <ChgVal val={q.changePercent} /> : <span style={{ color: COLORS.textMuted }}>{"—"}</span>}
                      </td>
                    )}
                    <td style={{ ...td, textAlign: "right", color: COLORS.gold }}>{usd(val)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <Badge color={statusColor[r.status.toLowerCase()] || COLORS.textMuted}>{r.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "flex-start", color: COLORS.textMuted, fontSize: 9, borderTop: `1px solid ${COLORS.border}22` }}>
          <Info size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Hand-curated from public reporting (CNBC, Yahoo Finance, Renaissance Capital, company filings), June 2026 — not a licensed feed.
            "Listed" names show live price &amp; market cap; "Expected/Filed" names show reported deal size / valuation only.
          </span>
        </div>
      </Panel>

      {/* ── LIVE FINNHUB CALENDAR ── */}
      <Panel>
        <PanelHeader
          icon={<CalendarClock size={14} color={COLORS.cyan} />}
          title="IPO CALENDAR (LIVE)"
          subtitle="Recent &amp; upcoming listings · source: Finnhub"
          right={configured ? <Badge color={COLORS.green}>LIVE</Badge> : <Badge color={COLORS.orange}>NOT CONFIGURED</Badge>}
        />
        {!configured ? (
          <div style={{ padding: 16, display: "flex", gap: 8, alignItems: "flex-start", color: COLORS.textDim, fontSize: 12 }}>
            <Info size={14} color={COLORS.orange} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Add a free <span style={{ ...mono, color: COLORS.purpleLight }}>FINNHUB_API_KEY</span> to your <span style={mono}>.env</span> to enable the live IPO calendar.
              Get one at <span style={{ color: COLORS.cyan }}>finnhub.io</span>. The curated list above works without it.
            </span>
          </div>
        ) : calLoading ? (
          <LoadingSpinner text="Loading IPO calendar..." />
        ) : events.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
            No IPOs reported in the current window.
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Date</th>
                  <th style={{ ...th, textAlign: "left" }}>Company</th>
                  <th style={{ ...th, textAlign: "left" }}>Symbol</th>
                  {!isMobile && <th style={{ ...th, textAlign: "left" }}>Exch</th>}
                  {!isMobile && <th style={{ ...th, textAlign: "right" }}>Price</th>}
                  {!isMobile && <th style={{ ...th, textAlign: "right" }}>Shares</th>}
                  <th style={{ ...th, textAlign: "right" }}>Deal</th>
                  <th style={{ ...th, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={`${e.symbol}-${e.date}-${i}`} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ ...td, color: COLORS.textDim, fontSize: 10 }}>{e.date || "—"}</td>
                    <td style={{ ...td, fontFamily: "inherit", color: COLORS.text }}>{(e.name || "—").slice(0, isMobile ? 18 : 40)}</td>
                    <td style={{ ...td, color: COLORS.purpleLight, fontWeight: 700 }}>{e.symbol || "—"}</td>
                    {!isMobile && <td style={{ ...td, color: COLORS.textDim }}>{e.exchange}</td>}
                    {!isMobile && <td style={{ ...td, textAlign: "right", color: COLORS.text }}>{e.price || "—"}</td>}
                    {!isMobile && <td style={{ ...td, textAlign: "right", color: COLORS.textDim }}>{e.shares > 0 ? fmtK(e.shares) : "—"}</td>}
                    <td style={{ ...td, textAlign: "right", color: COLORS.gold }}>{usd(e.dealValue)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {e.status
                        ? <Badge color={statusColor[e.status] || COLORS.textMuted}>{e.status}</Badge>
                        : <span style={{ color: COLORS.textMuted }}>{"—"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
