import { lazy, Suspense, useEffect, useRef } from "react";
import { useRoute, navigate, pathFor, routeByMnemonic } from "./router/index.jsx";
import { AppShell } from "./shell/AppShell.jsx";
import { installKeyboard } from "./shell/keyboard.js";
import { useAlertsEngine } from "./features/useAlertsEngine.js";
import { settings } from "./stores/settings.js";
import { Loading } from "./ui/Loading.jsx";
import { toast } from "./ui/toasts.js";
import ErrorBoundary from "./ErrorBoundary";

// Screens are code-split; every one is built on the kit. React.lazy keeps a
// failed import for good, so a screen whose chunk failed to load once would
// fail on every later render. retryFailedScreens() swaps those for a fresh
// lazy so the error boundary's RETRY really imports again.
const retries = [];

function screen(load) {
  let failed = false;
  const attempt = () => load().catch((e) => { failed = true; throw e; });
  let Lazy = lazy(attempt);
  retries.push(() => {
    if (!failed) return;
    failed = false;
    Lazy = lazy(attempt);
  });
  return function LazyScreen(props) {
    return <Lazy {...props} />;
  };
}

function retryFailedScreens() {
  for (const retry of retries) retry();
}

const Dashboard = screen(() => import("./screens/Dashboard.jsx"));
const Equities = screen(() => import("./screens/Equities.jsx"));
const Fx = screen(() => import("./screens/Fx.jsx"));
const Rates = screen(() => import("./screens/Rates.jsx"));
const Commodities = screen(() => import("./screens/Commodities.jsx"));
const Crypto = screen(() => import("./screens/Crypto.jsx"));
const Screener = screen(() => import("./screens/Screener.jsx"));
const Portfolio = screen(() => import("./screens/Portfolio.jsx"));
const News = screen(() => import("./screens/News.jsx"));
const Compare = screen(() => import("./screens/Compare.jsx"));
const Ipos = screen(() => import("./screens/Ipos.jsx"));
const Settings = screen(() => import("./screens/Settings.jsx"));

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
      <ErrorBoundary key={route ? route.name : "unknown"} screen={route ? route.mnemonic : ""} resetKey={path} onRetry={retryFailedScreens}>
        <Suspense fallback={<Loading />}>
          <Screen route={route} />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
