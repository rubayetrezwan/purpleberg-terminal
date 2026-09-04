import { createStore } from "./createStore.js";

export const ui = createStore("ui", { sidebarCollapsed: false }, { sanitize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed === true }) });

export function toggleSidebar() {
  ui.update((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
}
