import { createStore } from "./createStore.js";
import { newId } from "../lib/id.js";

// items: [{ id, symbol, op: "above"|"below", price, baseline, lastPrice,
//           createdAt, triggeredAt, triggeredPrice }]
export function isAlertItem(a) {
  return Boolean(a) && typeof a === "object" && typeof a.id === "string" && typeof a.symbol === "string"
    && (a.op === "above" || a.op === "below") && Number(a.price) > 0;
}
export const sanitizeAlerts = (s) => ({ items: Array.isArray(s.items) ? s.items.filter(isAlertItem) : [] });
export const alerts = createStore("alerts", { items: [] }, { sanitize: sanitizeAlerts });

export function addAlert({ symbol, op, price, baseline }) {
  const base = baseline == null || Number.isNaN(Number(baseline)) ? null : Number(baseline);
  const item = {
    id: newId(),
    symbol: String(symbol).trim().toUpperCase(),
    op: op === "below" ? "below" : "above",
    price: Number(price),
    baseline: base,
    lastPrice: base,
    createdAt: Date.now(),
    triggeredAt: null,
    triggeredPrice: null,
  };
  alerts.update((s) => ({ ...s, items: [...s.items, item] }));
  return item;
}

export function removeAlert(id) {
  alerts.update((s) => ({ ...s, items: s.items.filter((a) => a.id !== id) }));
}

export function rearmAlert(id, baseline) {
  const base = baseline == null ? null : Number(baseline);
  alerts.update((s) => ({
    ...s,
    items: s.items.map((a) =>
      a.id === id ? { ...a, baseline: base, lastPrice: base, triggeredAt: null, triggeredPrice: null } : a
    ),
  }));
}

export function replaceAlertItems(items) {
  alerts.update((s) => ({ ...s, items }));
}
