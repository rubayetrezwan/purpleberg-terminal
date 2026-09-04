import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, name, filters }]
export const sanitizeSavedScreens = (s) => ({
  items: Array.isArray(s.items)
    ? s.items.filter((x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.name === "string" && x.filters && typeof x.filters === "object" && !Array.isArray(x.filters))
    : [],
});
export const savedScreens = createStore("savedScreens", { items: [] }, { sanitize: sanitizeSavedScreens });

export function saveScreen(name, filters) {
  const item = { id: newId(), name: String(name).trim().slice(0, 40) || "Untitled", filters: { ...filters } };
  savedScreens.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

export function deleteScreen(id) {
  savedScreens.update((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
}
