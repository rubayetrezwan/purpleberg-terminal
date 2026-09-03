import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { startThemeSync } from "./theme/applyTheme.js";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";

startThemeSync();

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
