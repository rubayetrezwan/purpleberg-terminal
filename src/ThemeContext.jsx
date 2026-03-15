import { createContext, useContext, useState, useEffect } from "react";

const DARK = {
  bg: "#0a0a0f",
  bgPanel: "#111118",
  bgCard: "#1a1a24",
  bgInput: "#16161f",
  border: "#2a2a3a",
  borderLight: "#3a3a4a",
  purple: "#8b5cf6",
  purpleLight: "#a78bfa",
  purpleDark: "#6d28d9",
  purpleDim: "#4c1d95",
  green: "#22c55e",
  greenDim: "#166534",
  red: "#ef4444",
  redDim: "#991b1b",
  orange: "#f59e0b",
  orangeDim: "#92400e",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  gold: "#fbbf24",
  white: "#ffffff",
};

const LIGHT = {
  bg: "#f1f5f9",
  bgPanel: "#ffffff",
  bgCard: "#f8fafc",
  bgInput: "#e2e8f0",
  border: "#cbd5e1",
  borderLight: "#e2e8f0",
  purple: "#7c3aed",
  purpleLight: "#6d28d9",
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
  text: "#0f172a",
  textDim: "#475569",
  textMuted: "#64748b",
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
