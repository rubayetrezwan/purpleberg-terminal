import { settings, sanitizeSettings } from "./settings.js";
import { ui } from "./ui.js";
import { watchlist } from "./watchlist.js";
import { alerts } from "./alerts.js";
import { savedScreens } from "./savedScreens.js";
import { portfolio } from "./portfolio.js";
import { isPlainObject } from "./createStore.js";

export const STORES = { settings, ui, watchlist, alerts, savedScreens, portfolio };
export const EXPORT_VERSION = 1;

// Required array field per store; a section missing it is rejected outright.
// Everything else is repaired by each store's sanitizer on replace().
const REQUIRED_ARRAY = { watchlist: "symbols", alerts: "items", savedScreens: "items", portfolio: "transactions" };

const clone = (v) => JSON.parse(JSON.stringify(v));

export function exportAll() {
  const stores = {};
  for (const [name, store] of Object.entries(STORES)) stores[name] = clone(store.get());
  return { app: "purpleberg", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), stores };
}

export function validateExport(data) {
  if (!isPlainObject(data) || data.app !== "purpleberg" || !isPlainObject(data.stores)) {
    return "Not a Purpleberg export file";
  }
  if (data.version !== EXPORT_VERSION) return `Unsupported export version: ${data.version}`;
  for (const name of Object.keys(STORES)) {
    if (!(name in data.stores)) continue;
    const section = data.stores[name];
    if (!isPlainObject(section)) return `Invalid section: ${name}`;
    const field = REQUIRED_ARRAY[name];
    if (field && !Array.isArray(section[field])) return `Invalid section: ${name}`;
  }
  return null;
}

// Validates every section before writing any, so a bad file changes nothing.
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
