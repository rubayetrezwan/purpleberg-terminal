// Tiny persistent store: localStorage-backed (guarded), subscribable, and
// synced across tabs through the `storage` event. No React in here so
// node:test can exercise it; the hook lives in useStore.js.
const PREFIX = "purpleberg.";

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

function browserStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* private mode or blocked storage */
  }
  return null;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

export function createStore(key, initial, options = {}) {
  const { migrate = null, debounceMs = 150 } = options;
  const storage = "storage" in options ? options.storage : browserStorage();
  const fullKey = PREFIX + key;
  const listeners = new Set();
  let timer = null;

  function load() {
    let parsed = null;
    try {
      const raw = storage ? storage.getItem(fullKey) : null;
      if (raw != null) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const usable = (v) => v != null && typeof v === "object" && !Array.isArray(v);
    if (!usable(parsed) && migrate) {
      try { parsed = migrate(storage) ?? null; } catch { parsed = null; }
    }
    if (!usable(parsed)) return clone(initial);
    return { ...clone(initial), ...parsed };
  }

  let state = load();

  function persist() {
    if (!storage) return;
    try { storage.setItem(fullKey, JSON.stringify(state)); } catch { /* quota or blocked */ }
  }
  function schedulePersist() {
    if (debounceMs === 0) { persist(); return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; persist(); }, debounceMs);
  }
  function emit() { for (const fn of listeners) fn(state); }
  function set(next) { state = next; schedulePersist(); emit(); }

  const store = {
    key: fullKey,
    get: () => state,
    set,
    update: (fn) => set(fn(state)),
    replace: (next) => { state = { ...clone(initial), ...(next && typeof next === "object" ? next : {}) }; persist(); emit(); },
    reset: () => { state = clone(initial); persist(); emit(); },
    flush: () => { if (timer) { clearTimeout(timer); timer = null; } persist(); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    rehydrate: () => { state = load(); emit(); },
  };

  if (typeof window !== "undefined" && storage && storage === browserStorage()) {
    window.addEventListener("storage", (e) => { if (e.key === fullKey) store.rehydrate(); });
  }
  return store;
}
