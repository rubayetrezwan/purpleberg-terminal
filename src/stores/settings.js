import { createStore } from "./createStore.js";

export const THEMES = ["dark", "light", "system"];
export const DENSITIES = ["compact", "comfortable"];
export const REFRESH_OPTIONS = [10, 15, 30, 60];

export const SETTINGS_DEFAULTS = {
  theme: "dark",
  density: "compact",
  refreshSec: 15,
  defaultScreen: "WEI",
  notifications: false,
};

// Old versions stored the theme under a bare key.
export function migrateSettings(storage) {
  if (!storage) return null;
  let old = null;
  try { old = storage.getItem("purpleberg_theme"); } catch { return null; }
  if (old === "light" || old === "dark") return { theme: old };
  return null;
}

export function sanitizeSettings(input) {
  const s = input && typeof input === "object" ? input : {};
  return {
    theme: THEMES.includes(s.theme) ? s.theme : SETTINGS_DEFAULTS.theme,
    density: DENSITIES.includes(s.density) ? s.density : SETTINGS_DEFAULTS.density,
    refreshSec: REFRESH_OPTIONS.includes(Number(s.refreshSec)) ? Number(s.refreshSec) : SETTINGS_DEFAULTS.refreshSec,
    defaultScreen: typeof s.defaultScreen === "string" && /^[A-Z]{2,5}$/.test(s.defaultScreen) ? s.defaultScreen : SETTINGS_DEFAULTS.defaultScreen,
    notifications: s.notifications === true,
  };
}

export const settings = createStore("settings", SETTINGS_DEFAULTS, { migrate: migrateSettings });

export function setSetting(key, value) {
  settings.update((s) => sanitizeSettings({ ...s, [key]: value }));
}
