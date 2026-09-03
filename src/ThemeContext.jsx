import { createContext, useContext, useMemo } from "react";
import { setSetting } from "./stores/settings.js";
import { useResolvedTheme } from "./theme/useResolvedTheme.js";

// JS palette mirrors the CSS custom properties in index.css. Components that
// read colours inline via useColors() must stay in sync with :root[data-theme].
const DARK = {
  bg: "#000000",
  bgPanel: "#000000",
  bgCard: "#0d0d0d",
  bgElevated: "#0d0d0d",
  bgInput: "#0d0d0d",
  border: "#222222",
  borderLight: "#3a3a3a",
  purple: "#7c3aed",
  purpleLight: "#a78bfa",
  purpleActive: "#8b5cf6",
  purpleDark: "#6d28d9",
  purpleDim: "#2e2450",
  green: "#22c55e",
  greenDim: "#14532d",
  red: "#ef4444",
  redDim: "#7f1d1d",
  orange: "#f59e0b",
  orangeDim: "#78350f",
  blue: "#a3a3a3",
  cyan: "#a78bfa",
  text: "#e8e8e8",
  textDim: "#a3a3a3",
  textMuted: "#7d7d7d",
  gold: "#e8e8e8",
  white: "#ffffff",
};

const LIGHT = {
  bg: "#f4f4f1",
  bgPanel: "#f4f4f1",
  bgCard: "#ffffff",
  bgElevated: "#ffffff",
  bgInput: "#ffffff",
  border: "#d6d6d0",
  borderLight: "#b8b8b0",
  purple: "#6d28d9",
  purpleLight: "#5b21b6",
  purpleActive: "#6d28d9",
  purpleDark: "#4c1d95",
  purpleDim: "#ede9fe",
  green: "#15803d",
  greenDim: "#dcfce7",
  red: "#b91c1c",
  redDim: "#fee2e2",
  orange: "#b45309",
  orangeDim: "#fef3c7",
  blue: "#4a4a4a",
  cyan: "#5b21b6",
  text: "#161616",
  textDim: "#4a4a4a",
  textMuted: "#6e6e6e",
  gold: "#161616",
  white: "#ffffff",
};

const ThemeContext = createContext();

// Bridge for the old screens: `useColors()` keeps returning the JS palette and
// `toggle` writes to the settings store. Deleted in P2 with the last old screen.
export function ThemeProvider({ children }) {
  const theme = useResolvedTheme();
  const isDark = theme === "dark";
  const value = useMemo(
    () => ({ colors: isDark ? DARK : LIGHT, isDark, toggle: () => setSetting("theme", isDark ? "light" : "dark") }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
