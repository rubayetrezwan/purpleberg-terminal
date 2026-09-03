// Ids for alerts, transactions, saved screens, toasts. UUIDs where the
// runtime has them, a time-plus-random fallback otherwise.
export function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
