import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, Globe, TrendingUp, DollarSign, Landmark,
  Filter, Briefcase, Shield, Calendar, FileText,
  Zap, User, Maximize2, Minimize2,
  Command, ChevronRight, Sun, Moon, Menu, X, Gem, Bitcoin, GitCompare,
} from "lucide-react";
import { US_STOCKS, ts, fmt, fmtK } from "./config";
import { useColors, useTheme } from "./ThemeContext";
import { useQuotes, useNews, useIsMobile, useSearch } from "./hooks";
import { Badge, ChgVal } from "./shared";
import ErrorBoundary from "./ErrorBoundary";

// Screens
import MarketDashboard from "./screens/MarketDashboard";
import EquityAnalysis from "./screens/EquityAnalysis";
import FXDashboard from "./screens/FXDashboard";
import FixedIncome from "./screens/FixedIncome";
import CommoditiesDashboard from "./screens/CommoditiesDashboard";
import CryptoDashboard from "./screens/CryptoDashboard";
import StockScreener from "./screens/StockScreener";
import PortfolioManager from "./screens/PortfolioManager";
import RiskAnalytics from "./screens/RiskAnalytics";
import EconomicCalendar from "./screens/EconomicCalendar";
import NewsCenter from "./screens/NewsCenter";
import CompareStocks from "./screens/CompareStocks";

const SCREENS = [
  { id: "DASHBOARD", label: "Dashboard", icon: Globe, mnemonic: "WEI", desc: "Market Overview" },
  { id: "EQUITY", label: "Equities", icon: TrendingUp, mnemonic: "DES", desc: "Equity Analysis" },
  { id: "FX", label: "FX", icon: DollarSign, mnemonic: "WFX", desc: "Foreign Exchange" },
  { id: "FIXED_INCOME", label: "Fixed Income", icon: Landmark, mnemonic: "YAS", desc: "Bonds & Rates" },
  { id: "COMMODITIES", label: "Commodities", icon: Gem, mnemonic: "CMDT", desc: "Energy, Metals & Grains" },
  { id: "CRYPTO", label: "Crypto", icon: Bitcoin, mnemonic: "CRYP", desc: "Top 20 Cryptocurrencies" },
  { id: "SCREENER", label: "Screener", icon: Filter, mnemonic: "EQS", desc: "Stock Screener" },
  { id: "PORTFOLIO", label: "Portfolio", icon: Briefcase, mnemonic: "PORT", desc: "Portfolio Manager" },
  { id: "COMPARE", label: "Compare", icon: GitCompare, mnemonic: "COMP", desc: "Compare two stocks" },
  { id: "RISK", label: "Risk", icon: Shield, mnemonic: "MARS", desc: "Risk Analytics" },
  { id: "ECONOMICS", label: "Economics", icon: Calendar, mnemonic: "ECO", desc: "Economic Calendar" },
  { id: "NEWS", label: "News", icon: FileText, mnemonic: "TOP", desc: "News Center" },
];

// Bottom tab screens for mobile quick access
const MOBILE_TABS = [
  { id: "DASHBOARD", label: "Market", icon: Globe },
  { id: "EQUITY", label: "Equities", icon: TrendingUp },
  { id: "FX", label: "FX", icon: DollarSign },
  { id: "NEWS", label: "News", icon: FileText },
];

export default function App() {
  const COLORS = useColors();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [screen, setScreen] = useState("DASHBOARD");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [time, setTime] = useState(ts());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cmdRef = useRef(null);

  const isMobile = useIsMobile(768);
  const isTablet = useIsMobile(1024);

  // ── Global data: fetch stock quotes, share across screens ──
  const { data: allStockQuotes, loading: stocksLoading } = useQuotes(US_STOCKS, 15000);
  const { data: newsData, loading: newsLoading } = useNews(null, 45000);

  // ── Clock ──
  useEffect(() => {
    const iv = setInterval(() => setTime(ts()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Close mobile menu on screen change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [screen]);

  // ── Command palette keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        setCmdQuery("");
      }
      if (e.key === "Escape") { setCmdOpen(false); setMobileMenuOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (cmdOpen && cmdRef.current) cmdRef.current.focus();
  }, [cmdOpen]);

  const [initialSymbol, setInitialSymbol] = useState(null);

  // Live Yahoo Finance search for any stock
  const { results: searchResults, loading: searchLoading } = useSearch(cmdQuery, 400);

  const filteredScreens = cmdQuery
    ? SCREENS.filter(
        (s) =>
          s.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
          s.mnemonic.toLowerCase().includes(cmdQuery.toLowerCase()) ||
          s.desc.toLowerCase().includes(cmdQuery.toLowerCase())
      )
    : SCREENS;

  // Search pre-loaded stocks in command palette
  const filteredStocks = useMemo(() => {
    if (!cmdQuery || cmdQuery.length < 1) return [];
    const q = cmdQuery.toLowerCase();
    return allStockQuotes
      .filter((s) => s.symbol.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [cmdQuery, allStockQuotes]);

  // Yahoo search results (exclude already shown pre-loaded stocks)
  const yahooResults = useMemo(() => {
    if (!searchResults.length) return [];
    const loadedSyms = new Set(filteredStocks.map((s) => s.symbol));
    return searchResults
      .filter((r) => !loadedSyms.has(r.symbol))
      .slice(0, 6);
  }, [searchResults, filteredStocks]);

  const selectScreen = (id) => {
    setScreen(id);
    setCmdOpen(false);
    setCmdQuery("");
  };

  const selectStock = (symbol) => {
    setInitialSymbol(symbol);
    setScreen("EQUITY");
    setCmdOpen(false);
    setCmdQuery("");
  };

  // ── Ticker bar: top stocks for scrolling bottom bar ──
  const tickerStocks = useMemo(() => {
    return allStockQuotes
      .filter((q) => q.price > 0)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 20);
  }, [allStockQuotes]);

  const renderScreen = () => {
    switch (screen) {
      case "DASHBOARD":
        return <MarketDashboard allStockQuotes={allStockQuotes} news={newsData} />;
      case "EQUITY":
        return <EquityAnalysis allStockQuotes={allStockQuotes} initialSymbol={initialSymbol} onSymbolConsumed={() => setInitialSymbol(null)} />;
      case "FX":
        return <FXDashboard />;
      case "FIXED_INCOME":
        return <FixedIncome />;
      case "COMMODITIES":
        return <CommoditiesDashboard />;
      case "CRYPTO":
        return <CryptoDashboard />;
      case "SCREENER":
        return <StockScreener allStockQuotes={allStockQuotes} />;
      case "PORTFOLIO":
        return <PortfolioManager />;
      case "RISK":
        return <RiskAnalytics allStockQuotes={allStockQuotes} />;
      case "ECONOMICS":
        return <EconomicCalendar />;
      case "COMPARE":
        return <CompareStocks allStockQuotes={allStockQuotes} news={newsData} />;
      case "NEWS":
        return <NewsCenter news={newsData} loading={newsLoading} />;
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
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        input::placeholder { color: ${COLORS.textMuted}; }
        select { outline: none; }
        * { -webkit-tap-highlight-color: transparent; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
        @media (max-width: 1024px) {
          .hide-tablet { display: none !important; }
        }
      `}</style>

      {/* TOP BAR */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "0 8px" : "0 12px",
          height: isMobile ? 44 : 38,
          background: COLORS.bgPanel,
          borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <div
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ padding: 10, cursor: "pointer", margin: -6 }}
            >
              {mobileMenuOpen ? <X size={20} color={COLORS.text} /> : <Menu size={20} color={COLORS.text} />}
            </div>
          )}
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
            <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 800, letterSpacing: 1, color: COLORS.purpleLight }}>
              PURPLEBERG
            </span>
            {!isMobile && <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>TERMINAL</span>}
          </div>
          {!isMobile && (
            <>
              <div style={{ width: 1, height: 20, background: COLORS.border }} />
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{currentScreen?.mnemonic}</span>
              <span style={{ fontSize: 11, color: COLORS.textDim }}>|</span>
              <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 600 }}>{currentScreen?.desc}</span>
            </>
          )}
          {stocksLoading && (
            <span style={{ fontSize: 9, color: COLORS.orange, animation: "pulse 1.5s infinite" }}>
              Loading...
            </span>
          )}
        </div>

        {/* COMMAND BAR - hidden on mobile, shown as icon */}
        {isMobile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => { setCmdOpen(true); setCmdQuery(""); }}
              style={{ padding: 10, cursor: "pointer", margin: -6 }}
            >
              <Search size={18} color={COLORS.textMuted} />
            </div>
            <div onClick={toggleTheme} style={{ padding: 10, cursor: "pointer", margin: -6 }}>
              {isDark ? <Sun size={16} color={COLORS.gold} /> : <Moon size={16} color={COLORS.purpleDark} />}
            </div>
            <Badge color={allStockQuotes.length > 0 ? COLORS.green : COLORS.orange}>
              {allStockQuotes.length} LIVE
            </Badge>
          </div>
        ) : (
          <>
            <div
              onClick={() => { setCmdOpen(true); setCmdQuery(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 14px", background: COLORS.bgInput,
                border: `1px solid ${COLORS.border}`, borderRadius: 4,
                cursor: "pointer", minWidth: isTablet ? 200 : 300,
              }}
            >
              <Search size={13} color={COLORS.textMuted} />
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Search any stock, function... (Ctrl+K)</span>
              {!isTablet && (
                <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: "auto", padding: "1px 6px", background: COLORS.border + "44", borderRadius: 2 }}>
                  Ctrl+K
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                onClick={toggleTheme}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: COLORS.bgInput,
                  border: `1px solid ${COLORS.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {isDark ? <Sun size={14} color={COLORS.gold} /> : <Moon size={14} color={COLORS.purpleDark} />}
              </div>
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
          </>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* MOBILE SLIDE-OUT MENU */}
        {isMobile && mobileMenuOpen && (
          <>
            <div
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                zIndex: 90,
              }}
            />
            <div
              style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: 240, background: COLORS.bgPanel,
                borderRight: `1px solid ${COLORS.border}`,
                zIndex: 100, overflowY: "auto",
                animation: "slideIn 0.2s ease-out",
              }}
            >
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 1 }}>NAVIGATION</div>
              </div>
              {SCREENS.map((s) => {
                const Icon = s.icon;
                const active = screen === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => { setScreen(s.id); setMobileMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", cursor: "pointer",
                      background: active ? COLORS.purpleDim + "44" : "transparent",
                      borderLeft: active ? `3px solid ${COLORS.purple}` : "3px solid transparent",
                    }}
                  >
                    <Icon size={16} color={active ? COLORS.purpleLight : COLORS.textMuted} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? COLORS.purpleLight : COLORS.text }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.desc}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: 16, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: 1, textAlign: "center" }}>
                  PURPLEBERG v2.1.0
                  <div style={{ fontSize: 9, color: COLORS.purple, marginTop: 2, fontWeight: 600 }}>by Rubayet Rezwan</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* DESKTOP SIDEBAR */}
        {!isMobile && (
          <div
            style={{
              width: sidebarCollapsed ? 48 : (isTablet ? 130 : 160),
              background: COLORS.bgPanel,
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
              <div style={{ fontSize: 7, color: COLORS.textMuted }}>v2.1.0 | Live Data</div>
              <div style={{ fontSize: 8, color: COLORS.purple, marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>
                by Rubayet Rezwan
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflow: "auto", background: COLORS.bg }}>
          {/* key={screen} unmounts the boundary on navigation so a stale error
              from one screen doesn't stick when the user opens another. */}
          <ErrorBoundary key={screen} screen={screen}>
            {renderScreen()}
          </ErrorBoundary>
        </div>
      </div>

      {/* BOTTOM: Ticker (desktop) or Tab Bar (mobile) */}
      {isMobile ? (
        <div
          style={{
            height: 56, background: COLORS.bgPanel,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-around",
            flexShrink: 0,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = screen === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setScreen(tab.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, cursor: "pointer", padding: "6px 12px", minHeight: 44,
                  justifyContent: "center",
                  opacity: active ? 1 : 0.6,
                }}
              >
                <Icon size={18} color={active ? COLORS.purple : COLORS.textMuted} />
                <span style={{
                  fontSize: 9, fontWeight: active ? 700 : 500,
                  color: active ? COLORS.purpleLight : COLORS.textMuted,
                }}>
                  {tab.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            height: 24, background: COLORS.bgPanel,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center",
            overflow: "hidden", flexShrink: 0, position: "relative",
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: 24,
              animation: tickerStocks.length > 0 ? "tickerScroll 60s linear infinite" : "none",
              whiteSpace: "nowrap",
            }}
          >
            {/* Duplicate ticker items for seamless scrolling */}
            {[...tickerStocks, ...tickerStocks].map((s, i) => (
              <span key={`${s.symbol}-${i}`} style={{ fontSize: 10, whiteSpace: "nowrap", display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>{s.symbol}</span>
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
                <span style={{ color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>
                  {fmtK(s.marketCap)}
                </span>
                <span style={{ color: COLORS.textMuted, fontSize: 9 }}>
                  {s.pe > 0 ? `${fmt(s.pe, 1)}x` : ""}
                </span>
              </span>
            ))}
          </div>
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            display: "flex", alignItems: "center",
            padding: "0 12px",
            background: `linear-gradient(90deg, transparent, ${COLORS.bgPanel} 30%)`,
            fontSize: 10, color: COLORS.textMuted,
          }}>
            <span style={{ color: allStockQuotes.length > 0 ? COLORS.green : COLORS.red }}>●</span>
            {" "}
            {allStockQuotes.length > 0 ? `${allStockQuotes.length} LIVE` : "..."} | v2.1.0
          </div>
        </div>
      )}

      {/* COMMAND PALETTE */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "flex-start",
            justifyContent: "center",
            paddingTop: isMobile ? 0 : 100, zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isMobile ? "100%" : 520,
              maxHeight: isMobile ? "70vh" : "auto",
              background: COLORS.bgCard,
              border: isMobile ? "none" : `1px solid ${COLORS.border}`,
              borderRadius: isMobile ? "16px 16px 0 0" : 8,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${COLORS.purple}44`,
              display: "flex", flexDirection: "column",
            }}
          >
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: COLORS.border }} />
              </div>
            )}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: isMobile ? "8px 16px" : "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <Command size={16} color={COLORS.purple} />
              <input
                ref={cmdRef}
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (filteredStocks.length > 0) selectStock(filteredStocks[0].symbol);
                    else if (filteredScreens.length > 0) selectScreen(filteredScreens[0].id);
                  }
                }}
                placeholder="Search any stock, ETF, or function..."
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: COLORS.text, fontSize: isMobile ? 16 : 14, outline: "none",
                }}
              />
              <span
                onClick={() => setCmdOpen(false)}
                style={{ fontSize: 10, color: COLORS.textMuted, padding: "2px 6px", background: COLORS.border + "44", borderRadius: 2, cursor: "pointer" }}
              >
                {isMobile ? "CLOSE" : "ESC"}
              </span>
            </div>
            <div style={{ maxHeight: isMobile ? "55vh" : 360, overflowY: "auto" }}>
              {/* Pre-loaded stock search results */}
              {filteredStocks.length > 0 && (
                <>
                  <div style={{ padding: "6px 16px", fontSize: 9, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1, borderBottom: `1px solid ${COLORS.border}22` }}>
                    TRACKED EQUITIES
                  </div>
                  {filteredStocks.map((s) => (
                    <div
                      key={s.symbol}
                      onClick={() => selectStock(s.symbol)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: isMobile ? "12px 16px" : "8px 16px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${COLORS.border}22`,
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bgPanel)}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <TrendingUp size={14} color={COLORS.green} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.purpleLight }}>{s.symbol}</div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted }}>{(s.name || "").slice(0, 30)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{fmt(s.price)}</span>
                        <ChgVal val={s.changePercent} />
                        <span style={{ fontSize: 10, color: COLORS.textDim }}>{fmtK(s.marketCap)}</span>
                        <span style={{ fontSize: 10, color: COLORS.textMuted }}>{s.pe > 0 ? fmt(s.pe, 1) + "x" : "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* Yahoo Finance search results (any stock) */}
              {(yahooResults.length > 0 || searchLoading) && cmdQuery.length >= 2 && (
                <>
                  <div style={{ padding: "6px 16px", fontSize: 9, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1, borderBottom: `1px solid ${COLORS.border}22` }}>
                    {searchLoading ? "SEARCHING YAHOO FINANCE..." : "YAHOO FINANCE SEARCH"}
                  </div>
                  {yahooResults.map((r) => (
                    <div
                      key={r.symbol}
                      onClick={() => selectStock(r.symbol)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: isMobile ? "12px 16px" : "8px 16px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${COLORS.border}22`,
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bgPanel)}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Search size={14} color={COLORS.cyan} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.cyan }}>{r.symbol}</div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted }}>{(r.name || "").slice(0, 40)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge color={COLORS.blue}>{r.type || "EQUITY"}</Badge>
                        <Badge>{r.exchange || "—"}</Badge>
                        <ChevronRight size={12} color={COLORS.textMuted} />
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* Screen navigation results */}
              {filteredScreens.length > 0 && (
                <>
                  {filteredStocks.length > 0 && (
                    <div style={{ padding: "6px 16px", fontSize: 9, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1, borderBottom: `1px solid ${COLORS.border}22` }}>
                      FUNCTIONS
                    </div>
                  )}
                  {filteredScreens.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectScreen(s.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: isMobile ? "14px 16px" : "10px 16px",
                          cursor: "pointer",
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
