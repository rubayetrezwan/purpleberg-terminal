import { lazy, Suspense, useEffect, useRef } from "react";
import { useRoute, navigate, pathFor, routeByMnemonic } from "./router/index.jsx";
import { AppShell } from "./shell/AppShell.jsx";
import { installKeyboard } from "./shell/keyboard.js";
import { useAlertsEngine } from "./features/useAlertsEngine.js";
import { useNewsFeed } from "./features/newsFeed.jsx";
import { useQuotePool } from "./data/quotePool.jsx";
import { settings } from "./stores/settings.js";
import { Loading } from "./ui/Loading.jsx";
import { toast } from "./ui/toasts.js";
import ErrorBoundary from "./ErrorBoundary";

// Screens are code-split. The ones marked "old" are the pre-redesign screens,
// replaced one by one in Plans P2 and P3.
const Dashboard = lazy(() => import("./screens/Dashboard.jsx"));
const Equities = lazy(() => import("./screens/Equities.jsx"));
const FXDashboard = lazy(() => import("./screens/FXDashboard")); // old
const FixedIncome = lazy(() => import("./screens/FixedIncome")); // old
const CommoditiesDashboard = lazy(() => import("./screens/CommoditiesDashboard")); // old
const CryptoDashboard = lazy(() => import("./screens/CryptoDashboard")); // old
const StockScreener = lazy(() => import("./screens/StockScreener")); // old
const PortfolioManager = lazy(() => import("./screens/PortfolioManager")); // old
const EconomicCalendar = lazy(() => import("./screens/EconomicCalendar")); // old
const NewsCenter = lazy(() => import("./screens/NewsCenter")); // old
const CompareStocks = lazy(() => import("./screens/CompareStocks")); // old
const IpoCenter = lazy(() => import("./screens/IpoCenter")); // old
const Settings = lazy(() => import("./screens/Settings.jsx"));

function useDefaultScreen() {
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const { defaultScreen } = settings.get();
    if (window.location.pathname === "/" && !window.location.search && defaultScreen && defaultScreen !== "WEI") {
      const r = routeByMnemonic(defaultScreen);
      if (r) navigate(pathFor(r.name), { replace: true });
    }
  }, []);
}

function Screen({ route }) {
  const pool = useQuotePool();
  const { news, loading: newsLoading } = useNewsFeed();
  // Old screens expect the tracked-equity list only; the pool excludes index rows.
  const list = pool.equities;
  switch (route ? route.name : "dashboard") {
    case "equities": return <Equities />;
    case "screener": return <StockScreener allStockQuotes={list} />;
    case "compare": return <CompareStocks allStockQuotes={list} news={news} />;
    case "fx": return <FXDashboard />;
    case "rates": return <><FixedIncome /><EconomicCalendar /></>;
    case "commodities": return <CommoditiesDashboard />;
    case "crypto": return <CryptoDashboard />;
    case "ipos": return <IpoCenter />;
    case "portfolio": return <PortfolioManager />;
    case "news": return <NewsCenter news={news} loading={newsLoading} />;
    case "settings": return <Settings />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const { route, path } = useRoute();
  useAlertsEngine();
  useDefaultScreen();
  useEffect(() => installKeyboard(), []);
  useEffect(() => {
    if (!route) toast({ tone: "warn", title: "UNKNOWN FUNCTION", body: path });
  }, [route, path]);

  return (
    <AppShell>
      <ErrorBoundary key={route ? route.name : "unknown"} screen={route ? route.mnemonic : ""}>
        <Suspense fallback={<Loading />}>
          <Screen route={route} />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
