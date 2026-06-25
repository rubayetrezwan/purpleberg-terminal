import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { US_STOCKS } from "./config";
import { useColors, useTheme } from "./ThemeContext";
import { useQuotes, useNews, useIsMobile } from "./hooks";
import { LoadingSpinner } from "./shared";
import { SCREENS } from "./navConfig";
import ErrorBoundary from "./ErrorBoundary";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import MobileMenu from "./components/MobileMenu";
import BottomBar from "./components/BottomBar";
import CommandPalette from "./components/CommandPalette";

// Screens are code-split: each is its own chunk loaded on first navigation.
const MarketDashboard = lazy(() => import("./screens/MarketDashboard"));
const EquityAnalysis = lazy(() => import("./screens/EquityAnalysis"));
const FXDashboard = lazy(() => import("./screens/FXDashboard"));
const FixedIncome = lazy(() => import("./screens/FixedIncome"));
const CommoditiesDashboard = lazy(() => import("./screens/CommoditiesDashboard"));
const CryptoDashboard = lazy(() => import("./screens/CryptoDashboard"));
const StockScreener = lazy(() => import("./screens/StockScreener"));
const PortfolioManager = lazy(() => import("./screens/PortfolioManager"));
const RiskAnalytics = lazy(() => import("./screens/RiskAnalytics"));
const EconomicCalendar = lazy(() => import("./screens/EconomicCalendar"));
const NewsCenter = lazy(() => import("./screens/NewsCenter"));
const CompareStocks = lazy(() => import("./screens/CompareStocks"));
const IpoCenter = lazy(() => import("./screens/IpoCenter"));

export default function App() {
  useColors(); // keep theme subscription alive for re-render on toggle
  const { isDark, toggle: toggleTheme } = useTheme();
  const [screen, setScreen] = useState("DASHBOARD");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [initialSymbol, setInitialSymbol] = useState(null);

  const isMobile = useIsMobile(768);
  const isTablet = useIsMobile(1024);

  // Global data shared across screens.
  const { data: allStockQuotes, loading: stocksLoading } = useQuotes(US_STOCKS, 15000);
  const { data: newsData, loading: newsLoading } = useNews(null, 45000);

  // Close mobile menu on navigation.
  useEffect(() => { setMobileMenuOpen(false); }, [screen]);

  // Command palette keyboard shortcuts.
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

  const handleSymbolConsumed = useCallback(() => setInitialSymbol(null), []);

  const selectScreen = (id) => { setScreen(id); setCmdOpen(false); setCmdQuery(""); };
  const selectStock = (symbol) => { setInitialSymbol(symbol); setScreen("EQUITY"); setCmdOpen(false); setCmdQuery(""); };

  const tickerStocks = useMemo(
    () => allStockQuotes.filter((q) => q.price > 0).sort((a, b) => b.marketCap - a.marketCap).slice(0, 20),
    [allStockQuotes]
  );

  const currentScreen = SCREENS.find((s) => s.id === screen);

  const renderScreen = () => {
    switch (screen) {
      case "DASHBOARD": return <MarketDashboard allStockQuotes={allStockQuotes} news={newsData} />;
      case "EQUITY": return <EquityAnalysis allStockQuotes={allStockQuotes} initialSymbol={initialSymbol} onSymbolConsumed={handleSymbolConsumed} />;
      case "FX": return <FXDashboard />;
      case "FIXED_INCOME": return <FixedIncome />;
      case "COMMODITIES": return <CommoditiesDashboard />;
      case "CRYPTO": return <CryptoDashboard />;
      case "IPO": return <IpoCenter />;
      case "SCREENER": return <StockScreener allStockQuotes={allStockQuotes} />;
      case "PORTFOLIO": return <PortfolioManager />;
      case "RISK": return <RiskAnalytics allStockQuotes={allStockQuotes} />;
      case "ECONOMICS": return <EconomicCalendar />;
      case "COMPARE": return <CompareStocks allStockQuotes={allStockQuotes} news={newsData} />;
      case "NEWS": return <NewsCenter news={newsData} loading={newsLoading} />;
      default: return <MarketDashboard allStockQuotes={allStockQuotes} news={newsData} />;
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: "transparent", color: "var(--c-text)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar
        isMobile={isMobile}
        isTablet={isTablet}
        isDark={isDark}
        toggleTheme={toggleTheme}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        currentScreen={currentScreen}
        stocksLoading={stocksLoading}
        liveCount={allStockQuotes.length}
        onOpenCommand={() => { setCmdOpen(true); setCmdQuery(""); }}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {isMobile && mobileMenuOpen && (
          <MobileMenu screen={screen} setScreen={setScreen} onClose={() => setMobileMenuOpen(false)} />
        )}
        {!isMobile && (
          <Sidebar screen={screen} setScreen={setScreen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} isTablet={isTablet} />
        )}

        <main style={{ flex: 1, overflow: "auto", background: "transparent" }}>
          {/* key={screen} unmounts the boundary on navigation so a stale error
              from one screen doesn't stick when the user opens another. */}
          <ErrorBoundary key={screen} screen={screen}>
            <Suspense fallback={<LoadingSpinner text="Loading screen..." />}>
              {renderScreen()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <BottomBar isMobile={isMobile} tickerStocks={tickerStocks} liveCount={allStockQuotes.length} screen={screen} setScreen={setScreen} />

      <CommandPalette
        open={cmdOpen}
        query={cmdQuery}
        setQuery={setCmdQuery}
        allStockQuotes={allStockQuotes}
        isMobile={isMobile}
        onSelectScreen={selectScreen}
        onSelectStock={selectStock}
        onClose={() => setCmdOpen(false)}
      />
    </div>
  );
}
