import { createStore } from "./createStore.js";

export const ui = createStore("ui", { sidebarCollapsed: false });

export function toggleSidebar() {
  ui.update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
}
