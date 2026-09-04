import { newId } from "../lib/id.js";

// In-memory toast queue. Max five; the oldest drops first. Sticky toasts
// (alerts) stay until dismissed; others auto-dismiss.
const MAX = 5;
let items = [];
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function getToasts() { return items; }
export function subscribeToasts(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function toast({ tone = "info", title, body = "", actions = [], sticky = false, ttlMs = 4000 }) {
  const id = newId();
  items = [...items, { id, tone, title, body, actions, sticky, createdAt: Date.now() }].slice(-MAX);
  emit();
  if (!sticky) setTimeout(() => dismissToast(id), ttlMs);
  return id;
}

export function dismissToast(id) {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) { items = next; emit(); }
}

export function clearToasts() {
  if (items.length) { items = []; emit(); }
}
