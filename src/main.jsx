import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { startThemeSync } from "./theme/applyTheme.js";
import { QuotePoolProvider } from "./data/quotePool.jsx";
import { NewsProvider } from "./features/newsFeed.jsx";
import { QuickLookProvider } from "./features/quickLook.jsx";
import App from "./App";

startThemeSync();

createRoot(document.getElementById("root")).render(
  <QuotePoolProvider>
    <NewsProvider>
      <QuickLookProvider>
        <App />
      </QuickLookProvider>
    </NewsProvider>
  </QuotePoolProvider>
);
