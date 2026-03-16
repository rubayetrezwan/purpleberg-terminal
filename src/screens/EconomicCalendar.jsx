import { useState, useEffect } from "react";
import { Calendar, Landmark, BarChart3, RefreshCw } from "lucide-react";
import { useColors } from "../ThemeContext";
import { api } from "../api";
import { Panel, PanelHeader, Badge, MiniTable, LoadingSpinner } from "../shared";

export default function EconomicCalendar() {
  const COLORS = useColors();
  const [events, setEvents] = useState([]);
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.econCalendar();
      setEvents(data);
    } catch { }
    setLoading(false);
  };

  const fetchRates = async () => {
    setRatesLoading(true);
    try {
      const data = await api.treasuryRates();
      setRates(data);
    } catch { }
    setRatesLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchRates();
    const iv = setInterval(fetchData, 600_000); // Refresh every 10 min
    const iv2 = setInterval(fetchRates, 300_000); // Refresh every 5 min
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <Panel>
        <PanelHeader
          icon={<Calendar size={14} color={COLORS.blue} />}
          title="ECONOMIC CALENDAR"
          subtitle="Upcoming economic releases & central bank decisions"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge color={COLORS.green}>LIVE</Badge>
              <RefreshCw
                size={12}
                color={COLORS.textMuted}
                style={{ cursor: "pointer" }}
                onClick={fetchData}
              />
            </div>
          }
        />
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <LoadingSpinner text="Fetching economic events..." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Date", "Time", "Country", "Event", "Actual", "Forecast", "Previous", "Impact"].map((h) => (
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
                {events.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "6px 8px", color: COLORS.textDim, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{ev.date}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{ev.time}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <Badge color={COLORS.cyan}>{ev.country}</Badge>
                    </td>
                    <td style={{ padding: "6px 8px", color: COLORS.text, fontWeight: 600 }}>{ev.event}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace", color: ev.actual !== "—" ? COLORS.gold : COLORS.textDim, fontWeight: ev.actual !== "—" ? 700 : 400 }}>{ev.actual}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim }}>{ev.forecast}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono',monospace", color: COLORS.textDim }}>{ev.previous}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <Badge color={ev.impact === "high" ? COLORS.red : COLORS.orange}>{ev.impact.toUpperCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <Panel>
          <PanelHeader
            icon={<Landmark size={14} color={COLORS.gold} />}
            title="US TREASURY YIELDS"
            subtitle="Live from Yahoo Finance"
            right={ratesLoading ? <Badge color={COLORS.orange}>Loading</Badge> : <Badge color={COLORS.green}>LIVE</Badge>}
          />
          <MiniTable
            headers={["Tenor", "Yield", "Status"]}
            rows={[
              [
                <span style={{ color: COLORS.text }}>US 3-Month T-Bill</span>,
                <span style={{ color: COLORS.gold, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{rates.us3m ? rates.us3m.toFixed(2) + "%" : "—"}</span>,
                <Badge color={COLORS.green}>LIVE</Badge>,
              ],
              [
                <span style={{ color: COLORS.text }}>US 5-Year Treasury</span>,
                <span style={{ color: COLORS.gold, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{rates.us5y ? rates.us5y.toFixed(2) + "%" : "—"}</span>,
                <Badge color={COLORS.green}>LIVE</Badge>,
              ],
              [
                <span style={{ color: COLORS.text }}>US 10-Year Treasury</span>,
                <span style={{ color: COLORS.gold, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{rates.us10y ? rates.us10y.toFixed(2) + "%" : "—"}</span>,
                <Badge color={COLORS.green}>LIVE</Badge>,
              ],
              [
                <span style={{ color: COLORS.text }}>US 30-Year Treasury</span>,
                <span style={{ color: COLORS.gold, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{rates.us30y ? rates.us30y.toFixed(2) + "%" : "—"}</span>,
                <Badge color={COLORS.green}>LIVE</Badge>,
              ],
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
