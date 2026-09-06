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
export const isPlainObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

// options: { storage, migrate(storage), sanitize(state), debounceMs }
// `sanitize` runs on every hydrate, replace, and reset so a corrupt or
// hand-edited localStorage value can never reach the app unchecked.
export function createStore(key, initial, options = {}) {
  const { migrate = null, sanitize = null, debounceMs = 150 } = options;
  const storage = "storage" in options ? options.storage : browserStorage();
  const usingBrowserStorage = Boolean(storage) && storage === browserStorage();
  const fullKey = PREFIX + key;
  const listeners = new Set();
  let timer = null;

  const finish = (obj) => {
    const merged = { ...clone(initial), ...obj };
    if (!sanitize) return merged;
    try {
      return sanitize(merged);
    } catch (e) {
      console.error(`[store ${fullKey}] sanitize failed, using defaults`, e);
      return clone(initial);
    }
  };

  function write(value) {
    if (!storage) return;
    try { storage.setItem(fullKey, JSON.stringify(value)); } catch { /* quota or blocked */ }
  }

  // allowMigrate is false on a cross-tab rehydrate so a removed key cannot
  // resurrect legacy data. A successful migration is persisted at once so it
  // runs exactly once per browser.
  function load(allowMigrate) {
    let parsed = null;
    try {
      const raw = storage ? storage.getItem(fullKey) : null;
      if (raw != null) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (isPlainObject(parsed)) return finish(parsed);
    if (allowMigrate && migrate) {
      let migrated = null;
      try { migrated = migrate(storage) ?? null; } catch { migrated = null; }
      if (isPlainObject(migrated)) {
        const next = finish(migrated);
        write(next);
        return next;
      }
    }
    return finish({});
  }

  let state = load(true);

  function persist() { write(state); }
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    persist();
  }
  function schedulePersist() {
    if (debounceMs === 0) { persist(); return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; persist(); }, debounceMs);
  }
  function emit() {
    for (const fn of listeners) {
      try { fn(state); } catch (e) { console.error(`[store ${fullKey}] subscriber failed`, e); }
    }
  }
  function set(next) {
    if (!isPlainObject(next)) {
      console.error(`[store ${fullKey}] set ignored a non-object`, next);
      return;
    }
    state = next;
    schedulePersist();
    emit();
  }

  const store = {
    key: fullKey,
    get: () => state,
    set,
    update: (fn) => set(fn(state)),
    replace: (next) => { state = finish(isPlainObject(next) ? next : {}); persist(); emit(); },
    reset: () => { state = finish({}); persist(); emit(); },
    flush,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    // Cross-tab: a pending local write is newer than whatever just arrived,
    // so flush it instead of adopting the other tab's value.
    rehydrate: () => {
      if (timer) { flush(); return; }
      state = load(false);
      emit();
    },
  };

  if (typeof window !== "undefined" && usingBrowserStorage) {
    const flushIfDirty = () => { if (timer) flush(); };
    window.addEventListener("storage", (e) => { if (e.key === fullKey) store.rehydrate(); });
    window.addEventListener("pagehide", flushIfDirty);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushIfDirty(); });
    }
  }
  return store;
}
