import { settings, sanitizeSettings } from "./settings.js";
import { ui } from "./ui.js";
import { watchlist } from "./watchlist.js";
import { alerts } from "./alerts.js";
import { savedScreens } from "./savedScreens.js";
import { portfolio } from "./portfolio.js";

export const STORES = { settings, ui, watchlist, alerts, savedScreens, portfolio };
export const EXPORT_VERSION = 1;

export function exportAll() {
  const stores = {};
  for (const [name, store] of Object.entries(STORES)) stores[name] = store.get();
  return { app: "purpleberg", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), stores };
}

export function validateExport(data) {
  if (!data || typeof data !== "object" || data.app !== "purpleberg" || !data.stores || typeof data.stores !== "object") {
    return "Not a Purpleberg export file";
  }
  for (const name of Object.keys(STORES)) {
    if (name in data.stores) {
      const v = data.stores[name];
      if (v == null || typeof v !== "object" || Array.isArray(v)) return `Invalid section: ${name}`;
    }
  }
  return null;
}

export function importAll(data) {
  const error = validateExport(data);
  if (error) return { ok: false, error };
  for (const [name, store] of Object.entries(STORES)) {
    if (!(name in data.stores)) continue;
    store.replace(name === "settings" ? sanitizeSettings(data.stores[name]) : data.stores[name]);
  }
  return { ok: true };
}

export function resetAll() {
  for (const store of Object.values(STORES)) store.reset();
}

export { settings, ui, watchlist, alerts, savedScreens, portfolio };
