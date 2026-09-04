import { lazy, Suspense, useEffect, useRef } from "react";
import { useRoute, navigate, pathFor, routeByMnemonic } from "./router/index.jsx";
import { AppShell } from "./shell/AppShell.jsx";
import { installKeyboard } from "./shell/keyboard.js";
import { useAlertsEngine } from "./features/useAlertsEngine.js";
import { useNewsFeed } from "./features/newsFeed.jsx";
import { settings } from "./stores/settings.js";
import { Loading } from "./ui/Loading.jsx";
import { toast } from "./ui/toasts.js";
import ErrorBoundary from "./ErrorBoundary";

// Screens are code-split. The ones marked "old" are the pre-redesign screens,
// replaced one by one in Plans P2 and P3.
const Dashboard = lazy(() => import("./screens/Dashboard.jsx"));
const Equities = lazy(() => import("./screens/Equities.jsx"));
const Fx = lazy(() => import("./screens/Fx.jsx"));
const Rates = lazy(() => import("./screens/Rates.jsx"));
const CommoditiesDashboard = lazy(() => import("./screens/CommoditiesDashboard")); // old
const CryptoDashboard = lazy(() => import("./screens/CryptoDashboard")); // old
const Screener = lazy(() => import("./screens/Screener.jsx"));
const PortfolioManager = lazy(() => import("./screens/PortfolioManager")); // old
const NewsCenter = lazy(() => import("./screens/NewsCenter")); // old
const Compare = lazy(() => import("./screens/Compare.jsx"));
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
  const { news, loading: newsLoading } = useNewsFeed();
  switch (route ? route.name : "dashboard") {
    case "equities": return <Equities />;
    case "screener": return <Screener />;
    case "compare": return <Compare />;
    case "fx": return <Fx />;
    case "rates": return <Rates />;
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
