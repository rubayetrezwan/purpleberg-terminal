import { settings } from "../stores/settings.js";
import { resolveTheme, resolveDensity } from "./resolveTheme.js";

// Drives <html data-theme> and <html data-density> from the settings store
// and the OS preference. Also the source of truth for useResolvedTheme().
const mql = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

const listeners = new Set();
let current = compute();

function compute() {
  const s = settings.get();
  return { theme: resolveTheme(s.theme, mql ? mql.matches : true), density: resolveDensity(s.density) };
}

function paint() {
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.dataset.density = current.density;
}

function refresh() {
  const next = compute();
  if (next.theme === current.theme && next.density === current.density) return;
  current = next;
  paint();
  for (const fn of listeners) fn();
}

let stop = null;
export function startThemeSync() {
  if (stop) return stop;
  if (typeof document === "undefined") return () => {};
  paint();
  const unsub = settings.subscribe(refresh);
  if (mql) mql.addEventListener("change", refresh);
  stop = () => {
    unsub();
    if (mql) mql.removeEventListener("change", refresh);
    stop = null;
  };
  return stop;
}

export function getResolved() { return current; }
export function subscribeResolved(fn) { listeners.add(fn); return () => listeners.delete(fn); }
