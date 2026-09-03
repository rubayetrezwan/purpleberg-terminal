import { createContext, useContext, useState, useEffect } from "react";

// JS palette mirrors the CSS custom properties in index.css. Components that
// read colours inline via useColors() must stay in sync with :root[data-theme].
const DARK = {
  bg: "#07070d",
  bgPanel: "#0e0e17",
  bgCard: "#14141f",
  bgElevated: "#1a1a27",
  bgInput: "#14141e",
  border: "#26263a",
  borderLight: "#34344c",
  purple: "#8b5cf6",
  purpleLight: "#a78bfa",
  purpleActive: "#7c5cff",
  purpleDark: "#6d28d9",
  purpleDim: "#4c1d95",
  green: "#22c55e",
  greenDim: "#166534",
  red: "#ef4444",
  redDim: "#991b1b",
  orange: "#f59e0b",
  orangeDim: "#92400e",
  blue: "#3b82f6",
  cyan: "#22d3ee",
  text: "#e7e9f3",
  textDim: "#9aa3b8",
  textMuted: "#646d85",
  gold: "#fbbf24",
  white: "#ffffff",
};

const LIGHT = {
  bg: "#eef1f6",
  bgPanel: "#ffffff",
  bgCard: "#f7f9fc",
  bgElevated: "#ffffff",
  bgInput: "#eef1f6",
  border: "#d4dae6",
  borderLight: "#e3e8f0",
  purple: "#7c3aed",
  purpleLight: "#6d28d9",
  purpleActive: "#6d28d9",
  purpleDark: "#5b21b6",
  purpleDim: "#ede9fe",
  green: "#16a34a",
  greenDim: "#dcfce7",
  red: "#dc2626",
  redDim: "#fee2e2",
  orange: "#d97706",
  orangeDim: "#fef3c7",
  blue: "#2563eb",
  cyan: "#0891b2",
  text: "#10131c",
  textDim: "#475069",
  textMuted: "#6b7488",
  gold: "#b45309",
  white: "#ffffff",
};

const ThemeContext = createContext();

const THEME_KEY = "purpleberg_theme";

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {}
    // Drive the CSS custom properties in index.css. useColors() still returns
    // the JS palette for components that read colours inline.
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);
  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
