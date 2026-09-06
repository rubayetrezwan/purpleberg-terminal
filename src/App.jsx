import { lazy, Suspense, useEffect, useRef } from "react";
import { useRoute, navigate, pathFor, routeByMnemonic } from "./router/index.jsx";
import { AppShell } from "./shell/AppShell.jsx";
import { installKeyboard } from "./shell/keyboard.js";
import { useAlertsEngine } from "./features/useAlertsEngine.js";
import { settings } from "./stores/settings.js";
import { Loading } from "./ui/Loading.jsx";
import { toast } from "./ui/toasts.js";
import ErrorBoundary from "./ErrorBoundary";

// Screens are code-split; every one is built on the kit.
const Dashboard = lazy(() => import("./screens/Dashboard.jsx"));
const Equities = lazy(() => import("./screens/Equities.jsx"));
const Fx = lazy(() => import("./screens/Fx.jsx"));
const Rates = lazy(() => import("./screens/Rates.jsx"));
const Commodities = lazy(() => import("./screens/Commodities.jsx"));
const Crypto = lazy(() => import("./screens/Crypto.jsx"));
const Screener = lazy(() => import("./screens/Screener.jsx"));
const Portfolio = lazy(() => import("./screens/Portfolio.jsx"));
const News = lazy(() => import("./screens/News.jsx"));
const Compare = lazy(() => import("./screens/Compare.jsx"));
const Ipos = lazy(() => import("./screens/Ipos.jsx"));
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
  switch (route ? route.name : "dashboard") {
    case "equities": return <Equities />;
    case "screener": return <Screener />;
    case "compare": return <Compare />;
    case "fx": return <Fx />;
    case "rates": return <Rates />;
    case "commodities": return <Commodities />;
    case "crypto": return <Crypto />;
    case "ipos": return <Ipos />;
    case "portfolio": return <Portfolio />;
    case "news": return <News />;
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
