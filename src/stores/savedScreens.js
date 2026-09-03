import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, name, filters }]
export const savedScreens = createStore("savedScreens", { items: [] });

export function saveScreen(name, filters) {
  const item = { id: newId(), name: String(name).trim().slice(0, 40) || "Untitled", filters: { ...filters } };
  savedScreens.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

export function deleteScreen(id) {
  savedScreens.update((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
}
