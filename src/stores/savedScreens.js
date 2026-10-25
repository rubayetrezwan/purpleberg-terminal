import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, name, filters, preset, sort }]. preset and sort came later, so
// a screen saved before them has neither and loads with both null.
const cleanPreset = (p) => (typeof p === "string" && p ? p : null);
const cleanSort = (s) =>
  s && typeof s === "object" && typeof s.key === "string" && s.key && (s.dir === "asc" || s.dir === "desc")
    ? { key: s.key, dir: s.dir }
    : null;

export const sanitizeSavedScreens = (s) => ({
  items: Array.isArray(s.items)
    ? s.items
      .filter((x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.name === "string" && x.filters && typeof x.filters === "object" && !Array.isArray(x.filters))
      .map((x) => ({ ...x, preset: cleanPreset(x.preset), sort: cleanSort(x.sort) }))
    : [],
});
export const savedScreens = createStore("savedScreens", { items: [] }, { sanitize: sanitizeSavedScreens });

// The preset is part of the screen: "NEAR 52W HI" plus a P/E cap saved
// without it would reopen as every stock under the cap.
export function saveScreen(name, filters, { preset = null, sort = null } = {}) {
  const item = {
    id: newId(),
    name: String(name).trim().slice(0, 40) || "Untitled",
    filters: { ...filters },
    preset: cleanPreset(preset),
    sort: cleanSort(sort),
  };
  savedScreens.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

// Returns what was removed and where it sat, so the caller can offer UNDO.
export function deleteScreen(id) {
  const index = savedScreens.get().items.findIndex((x) => x.id === id);
  if (index < 0) return null;
  const item = savedScreens.get().items[index];
  savedScreens.update((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
  return { item, index };
}

// Puts a deleted screen back in its old slot. A screen that is already back
// (UNDO pressed twice, or another tab restored it) is left alone.
export function restoreScreen(item, index) {
  savedScreens.update((s) => {
    if (s.items.some((x) => x.id === item.id)) return s;
    const items = s.items.slice();
    items.splice(Math.min(Math.max(0, index), items.length), 0, item);
    return { ...s, items };
  });
}
