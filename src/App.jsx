import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, Globe, TrendingUp, DollarSign, Landmark, Activity,
  Filter, Briefcase, Shield, Calendar, FileText, MessageSquare,
  Brain, Zap, Bell, Settings, User, Maximize2, Minimize2,
  Command, ChevronRight,
} from "lucide-react";
import { COLORS, US_STOCKS, ts, fmt } from "./config";
import { useQuotes, useNews } from "./hooks";
import { api } from "./api";
import { Badge, ChgVal } from "./shared";

// Screens
import MarketDashboard from "./screens/MarketDashboard";
import EquityAnalysis from "./screens/EquityAnalysis";
import FXDashboard from "./screens/FXDashboard";
import FixedIncome from "./screens/FixedIncome";
import OptionsPricer from "./screens/OptionsPricer";
import StockScreener from "./screens/StockScreener";
import PortfolioManager from "./screens/PortfolioManager";
import RiskAnalytics from "./screens/RiskAnalytics";
import EconomicCalendar from "./screens/EconomicCalendar";
import NewsCenter from "./screens/NewsCenter";
import Messaging from "./screens/Messaging";
import AIAssistant from "./screens/AIAssistant";

const SCREENS = [
  { id: "DASHBOARD", label: "Dashboard", icon: Globe, mnemonic: "WEI", desc: "Market Overview" },
  { id: "EQUITY", label: "Equities", icon: TrendingUp, mnemonic: "DES", desc: "Equity Analysis" },
  { id: "FX", label: "FX", icon: DollarSign, mnemonic: "WFX", desc: "Foreign Exchange" },
  { id: "FIXED_INCOME", label: "Fixed Income", icon: Landmark, mnemonic: "YAS", desc: "Bonds & Rates" },
  { id: "OPTIONS", label: "Options", icon: Activity, mnemonic: "OVME", desc: "Derivatives Pricing" },
  { id: "SCREENER", label: "Screener", icon: Filter, mnemonic: "EQS", desc: "Stock Screener" },
  { id: "PORTFOLIO", label: "Portfolio", icon: Briefcase, mnemonic: "PORT", desc: "Portfolio Manager" },
  { id: "RISK", label: "Risk", icon: Shield, mnemonic: "MARS", desc: "Risk Analytics" },
  { id: "ECONOMICS", label: "Economics", icon: Calendar, mnemonic: "ECO", desc: "Economic Calendar" },
  { id: "NEWS", label: "News", icon: FileText, mnemonic: "TOP", desc: "News Center" },
  { id: "MESSAGING", label: "IB Chat", icon: MessageSquare, mnemonic: "MSG", desc: "Messaging" },
  { id: "AI", label: "ASKB", icon: Brain, mnemonic: "ASKB", desc: "AI Assistant" },
];

export default function App() {
  const [screen, setScreen] = useState("DASHBOARD");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [time, setTime] = useState(ts());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const cmdRef = useRef(null);

  // ── Global data: fetch US stock quotes + DSE data, share across screens ──
  const { data: usStockQuotes, loading: stocksLoading } = useQuotes(US_STOCKS, 20000);
  const [dseQuotes, setDseQuotes] = useState([]);
  const { data: newsData, loading: newsLoading } = useNews(null, 120000);

  // Fetch DSE (Bangladesh) stocks
  useEffect(() => {
    const fetchDSE = async () => {
      try {
        const data = await api.dse();
        setDseQuotes(data);
      } catch {}
    };
    fetchDSE();
    const iv = setInterval(fetchDSE, 60000); // DSE data refreshes every minute
    return () => clearInterval(iv);
  }, []);

  // Merge US + BD stocks
  const allStockQuotes = useMemo(() => {
    return [...usStockQuotes, ...dseQuotes];
  }, [usStockQuotes, dseQuotes]);

  // ── Clock ──
  useEffect(() => {
    const iv = setInterval(() => setTime(ts()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Command palette keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        setCmdQuery("");
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (cmdOpen && cmdRef.current) cmdRef.current.focus();
  }, [cmdOpen]);

  const filteredScreens = cmdQuery
    ? SCREENS.filter(
        (s) =>
          s.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
          s.mnemonic.toLowerCase().includes(cmdQuery.toLowerCase()) ||
          s.desc.toLowerCase().includes(cmdQuery.toLowerCase())
      )
    : SCREENS;

  const selectScreen = (id) => {
    setScreen(id);
    setCmdOpen(false);
    setCmdQuery("");
  };

  // ── Ticker bar: top 6 stocks for bottom bar ──
  const tickerStocks = useMemo(() => {
    return allStockQuotes
      .filter((q) => q.marketCap > 1e11)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 8);
  }, [allStockQuotes]);

  const renderScreen = () => {
    switch (screen) {
      case "DASHBOARD":
        return <MarketDashboard allStockQuotes={allStockQuotes} news={newsData} />;
      case "EQUITY":
        return <EquityAnalysis allStockQuotes={allStockQuotes} />;
      case "FX":
        return <FXDashboard />;
      case "FIXED_INCOME":
        return <FixedIncome />;
      case "OPTIONS":
        return <OptionsPricer />;
      case "SCREENER":
        return <StockScreener allStockQuotes={allStockQuotes} />;
      case "PORTFOLIO":
        return <PortfolioManager />;
      case "RISK":
        return <RiskAnalytics allStockQuotes={allStockQuotes} />;
      case "ECONOMICS":
        return <EconomicCalendar />;
      case "NEWS":
        return <NewsCenter news={newsData} loading={newsLoading} />;
      case "MESSAGING":
        return <Messaging />;
      case "AI":
        return <AIAssistant />;
      default:
        return <MarketDashboard allStockQuotes={allStockQuotes} news={newsData} />;
    }
  };

  const currentScreen = SCREENS.find((s) => s.id === screen);

  return (
    <div
      style={{
        width: "100%", height: "100vh", background: COLORS.bg,
        color: COLORS.text, fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.purple}; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input::placeholder { color: ${COLORS.textMuted}; }
        select { outline: none; }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px", height: 38, background: COLORS.bgPanel,
          borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleDark})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Zap size={12} color={COLORS.white} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: COLORS.purpleLight }}>
              PURPLEBERG
            </span>
            <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>TERMINAL</span>
          </div>
          <div style={{ width: 1, height: 20, background: COLORS.border }} />
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{currentScreen?.mnemonic}</span>
          <span style={{ fontSize: 11, color: COLORS.textDim }}>|</span>
          <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 600 }}>{currentScreen?.desc}</span>
          {stocksLoading && (
            <span style={{ fontSize: 9, color: COLORS.orange, animation: "pulse 1.5s infinite" }}>
              Loading data...
            </span>
          )}
        </div>

        {/* COMMAND BAR */}
        <div
          onClick={() => { setCmdOpen(true); setCmdQuery(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px", background: COLORS.bgInput,
            border: `1px solid ${COLORS.border}`, borderRadius: 4,
            cursor: "pointer", minWidth: 300,
          }}
        >
          <Search size={13} color={COLORS.textMuted} />
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Search functions... (Ctrl+K)</span>
          <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: "auto", padding: "1px 6px", background: COLORS.border + "44", borderRadius: 2 }}>
            ⌘K
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: COLORS.green }}>
            {time}
          </span>
          <div style={{ width: 1, height: 20, background: COLORS.border }} />
          <Badge color={allStockQuotes.length > 0 ? COLORS.green : COLORS.orange}>
            {allStockQuotes.length} LIVE
          </Badge>
          <div
            style={{
              width: 24, height: 24, borderRadius: 12,
              background: COLORS.purpleDim,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <User size={12} color={COLORS.purpleLight} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ═══ SIDEBAR ═══ */}
        <div
          style={{
            width: sidebarCollapsed ? 48 : 160, background: COLORS.bgPanel,
            borderRight: `1px solid ${COLORS.border}`, flexShrink: 0,
            display: "flex", flexDirection: "column", transition: "width 0.2s",
          }}
        >
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              padding: 8, cursor: "pointer",
              borderBottom: `1px solid ${COLORS.border}`, textAlign: "center",
            }}
          >
            {sidebarCollapsed ? (
              <Maximize2 size={14} color={COLORS.textMuted} />
            ) : (
              <Minimize2 size={14} color={COLORS.textMuted} />
            )}
          </div>
          {SCREENS.map((s) => {
            const Icon = s.icon;
            const active = screen === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setScreen(s.id)}
                title={s.desc}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: sidebarCollapsed ? "10px 0" : "8px 12px",
                  cursor: "pointer",
                  background: active ? COLORS.purpleDim + "44" : "transparent",
                  borderLeft: active ? `3px solid ${COLORS.purple}` : "3px solid transparent",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
                onMouseOver={(e) => { if (!active) e.currentTarget.style.background = COLORS.bgCard; }}
                onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={14} color={active ? COLORS.purpleLight : COLORS.textMuted} />
                {!sidebarCollapsed && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? COLORS.purpleLight : COLORS.textDim }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.textMuted }}>{s.mnemonic}</div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: "auto", padding: 8, borderTop: `1px solid ${COLORS.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 8, color: COLORS.textMuted, letterSpacing: 1 }}>PURPLEBERG</div>
            <div style={{ fontSize: 7, color: COLORS.textMuted }}>v2.0.0 • Live Data</div>
          </div>
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ flex: 1, overflow: "auto", background: COLORS.bg }}>
          {renderScreen()}
        </div>
      </div>

      {/* ═══ BOTTOM TICKER ═══ */}
      <div
        style={{
          height: 24, background: COLORS.bgPanel,
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex", alignItems: "center",
          padding: "0 12px", gap: 16, overflow: "hidden", flexShrink: 0,
        }}
      >
        {tickerStocks.map((s) => (
          <span key={s.symbol} style={{ fontSize: 10, whiteSpace: "nowrap", display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>{s.symbol.replace(".DS", "")}</span>
            <span style={{ color: COLORS.text, fontFamily: "'JetBrains Mono',monospace" }}>
              {fmt(s.price, s.price > 1000 ? 0 : 2)}
            </span>
            <span
              style={{
                color: (s.changePercent ?? 0) >= 0 ? COLORS.green : COLORS.red,
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              {(s.changePercent ?? 0) >= 0 ? "+" : ""}
              {fmt(s.changePercent)}%
            </span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.textMuted }}>
          <span style={{ color: allStockQuotes.length > 0 ? COLORS.green : COLORS.red }}>●</span>
          {" "}
          {allStockQuotes.length > 0 ? `${allStockQuotes.length} securities streaming` : "Connecting..."} | Purpleberg Terminal
        </span>
      </div>

      {/* ═══ COMMAND PALETTE ═══ */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: 100, zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520, background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`, borderRadius: 8,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${COLORS.purple}44`,
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <Command size={16} color={COLORS.purple} />
              <input
                ref={cmdRef}
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredScreens.length > 0) selectScreen(filteredScreens[0].id);
                }}
                placeholder="Type a function name, mnemonic, or keyword..."
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: COLORS.text, fontSize: 14, outline: "none",
                }}
              />
              <span style={{ fontSize: 10, color: COLORS.textMuted, padding: "2px 6px", background: COLORS.border + "44", borderRadius: 2 }}>
                ESC
              </span>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {filteredScreens.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.id}
                    onClick={() => selectScreen(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", cursor: "pointer",
                      borderBottom: `1px solid ${COLORS.border}22`,
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bgPanel)}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Icon size={16} color={COLORS.purple} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.desc}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                        color: COLORS.purpleLight, padding: "2px 8px",
                        background: COLORS.purpleDim + "44", borderRadius: 3,
                      }}
                    >
                      {s.mnemonic}
                    </span>
                    <ChevronRight size={14} color={COLORS.textMuted} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
