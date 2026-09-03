import { createRoot } from "react-dom/client";
import "./index.css";
import { ThemeProvider } from "./ThemeContext";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
