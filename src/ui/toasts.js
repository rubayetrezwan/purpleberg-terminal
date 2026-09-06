import { newId } from "../lib/id.js";

// In-memory toast queue. Max five; when full, the oldest non-sticky toast is
// dropped first so a fired alert (sticky) is never evicted by chatter. Sticky
// toasts stay until dismissed; others auto-dismiss.
const MAX = 5;
let items = [];
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function getToasts() { return items; }
export function subscribeToasts(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function truncate(list) {
  const next = list.slice();
  while (next.length > MAX) {
    const victim = next.findIndex((t) => !t.sticky);
    next.splice(victim >= 0 ? victim : 0, 1);
  }
  return next;
}

export function toast({ tone = "info", title, body = "", actions, sticky = false, ttlMs = 4000 }) {
  const id = newId();
  const item = { id, tone, title, body, actions: Array.isArray(actions) ? actions : [], sticky, createdAt: Date.now() };
  items = truncate([...items, item]);
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
