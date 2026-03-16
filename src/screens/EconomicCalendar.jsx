import { Calendar, Landmark, BarChart3 } from "lucide-react";
import { useColors } from "../ThemeContext";
import { Panel, PanelHeader, Badge, ChgVal, MiniTable } from "../shared";

// Economic calendar data - refreshed periodically
// In production, this would come from TradingEconomics or similar API
const ECON_EVENTS = [
  { date: "Recurring", time: "08:30 ET", event: "US CPI (YoY)", forecast: "Check BLS", impact: "high" },
  { date: "Recurring", time: "08:30 ET", event: "US Core CPI (MoM)", forecast: "Check BLS", impact: "high" },
  { date: "Recurring", time: "08:30 ET", event: "US PPI (MoM)", forecast: "Check BLS", impact: "med" },
  { date: "Recurring", time: "10:00 ET", event: "US Michigan Sentiment", forecast: "Check UMich", impact: "med" },
  { date: "Recurring", time: "08:30 ET", event: "US Non-Farm Payrolls", forecast: "Check BLS", impact: "high" },
  { date: "Recurring", time: "08:30 ET", event: "US GDP (QoQ)", forecast: "Check BEA", impact: "high" },
  { date: "Recurring", time: "14:00 ET", event: "FOMC Rate Decision", forecast: "Check Fed", impact: "high" },
  { date: "Recurring", time: "07:00 ET", event: "ECB Interest Rate Decision", forecast: "Check ECB", impact: "high" },
  { date: "Recurring", time: "—", event: "BOJ Interest Rate Decision", forecast: "Check BOJ", impact: "high" },
  { date: "Recurring", time: "08:30 ET", event: "US Jobless Claims", forecast: "Weekly", impact: "med" },
  { date: "Recurring", time: "10:00 ET", event: "US ISM Manufacturing PMI", forecast: "Check ISM", impact: "high" },
  { date: "Recurring", time: "—", event: "China Manufacturing PMI", forecast: "Check NBS", impact: "med" },
];

export default function EconomicCalendar() {
  const COLORS = useColors();
  return (
    <div style={{ padding: 12 }}>
      <Panel>
        <PanelHeader
          icon={<Calendar size={14} color={COLORS.blue} />}
          title="ECONOMIC CALENDAR"
          subtitle="Key recurring economic releases & central bank decisions"
          right={<Badge>Reference</Badge>}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Schedule", "Time", "Event", "Source", "Impact"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 8, textAlign: "left", color: COLORS.textMuted,
                      borderBottom: `1px solid ${COLORS.border}`, fontSize: 10,
                      fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ECON_EVENTS.map((ev, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                  <td style={{ padding: "6px 8px", color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace" }}>{ev.date}</td>
                  <td style={{ padding: "6px 8px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{ev.time}</td>
                  <td style={{ padding: "6px 8px", color: COLORS.text, fontWeight: 600 }}>{ev.event}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim }}>{ev.forecast}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <Badge color={ev.impact === "high" ? COLORS.red : COLORS.orange}>{ev.impact.toUpperCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <Panel>
          <PanelHeader icon={<Landmark size={14} color={COLORS.gold} />} title="CENTRAL BANK RATES" subtitle="Current policy rates" />
          <MiniTable
            headers={["Central Bank", "Rate", "Website"]}
            rows={[
              [<span style={{ color: COLORS.text }}>US Federal Reserve</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>Check Fed</span>, <a href="https://www.federalreserve.gov" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 10 }}>federalreserve.gov</a>],
              [<span style={{ color: COLORS.text }}>European Central Bank</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>Check ECB</span>, <a href="https://www.ecb.europa.eu" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 10 }}>ecb.europa.eu</a>],
              [<span style={{ color: COLORS.text }}>Bank of England</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>Check BOE</span>, <a href="https://www.bankofengland.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 10 }}>bankofengland.co.uk</a>],
              [<span style={{ color: COLORS.text }}>Bank of Japan</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>Check BOJ</span>, <a href="https://www.boj.or.jp/en" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 10 }}>boj.or.jp</a>],
              [<span style={{ color: COLORS.text }}>RBI (India)</span>, <span style={{ color: COLORS.gold, fontWeight: 700 }}>Check RBI</span>, <a href="https://www.rbi.org.in" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.purpleLight, fontSize: 10 }}>rbi.org.in</a>],
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader icon={<BarChart3 size={14} color={COLORS.cyan} />} title="DATA SOURCES" subtitle="Where to find live economic data" />
          <div style={{ padding: 12 }}>
            {[
              { l: "US Bureau of Labor Statistics", url: "https://www.bls.gov", desc: "CPI, PPI, Employment" },
              { l: "US Bureau of Economic Analysis", url: "https://www.bea.gov", desc: "GDP, Trade, Income" },
              { l: "FRED (St. Louis Fed)", url: "https://fred.stlouisfed.org", desc: "380K+ economic data series" },
              { l: "TradingEconomics", url: "https://tradingeconomics.com/calendar", desc: "Global economic calendar" },
              { l: "Investing.com", url: "https://www.investing.com/economic-calendar", desc: "Economic calendar + forecasts" },
            ].map((item) => (
              <div key={item.l} style={{ marginBottom: 8, padding: "4px 0", borderBottom: `1px solid ${COLORS.border}22` }}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: COLORS.purpleLight, textDecoration: "none", fontWeight: 600 }}>
                  {item.l} ↗
                </a>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
