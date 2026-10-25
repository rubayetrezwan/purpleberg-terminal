import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { startThemeSync } from "./theme/applyTheme.js";
import { QuotePoolProvider } from "./data/quotePool.jsx";
import { NewsProvider } from "./features/newsFeed.jsx";
import { QuickLookProvider } from "./features/quickLook.jsx";
import App from "./App";
import { reloadForNewBuild } from "./ErrorBoundary";

startThemeSync();

// Vite reports a chunk or its CSS that failed to preload, which after a
// redeploy means this tab is running an older build. Reload into the current
// one; if that was just tried, let the error reach the screen's boundary.
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForNewBuild()) e.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <QuotePoolProvider>
    <NewsProvider>
      <QuickLookProvider>
        <App />
      </QuickLookProvider>
    </NewsProvider>
  </QuotePoolProvider>
);
