import { useSyncExternalStore } from "react";
import { getResolved, subscribeResolved } from "./applyTheme.js";

// "dark" | "light" after system resolution.
export function useResolvedTheme() {
  return useSyncExternalStore(subscribeResolved, getResolved, getResolved).theme;
}

export function useDensity() {
  return useSyncExternalStore(subscribeResolved, getResolved, getResolved).density;
}
