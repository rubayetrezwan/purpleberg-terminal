import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryStorage } from "./createStore.js";

test("starts from initial and persists on set", () => {
  const storage = memoryStorage();
  const s = createStore("t1", { a: 1, b: [] }, { storage, debounceMs: 0 });
  assert.deepEqual(s.get(), { a: 1, b: [] });
  s.set({ a: 2, b: [1] });
  assert.equal(storage.getItem("purpleberg.t1"), JSON.stringify({ a: 2, b: [1] }));
});

test("hydrates from storage and fills missing keys from initial", () => {
  const storage = memoryStorage();
  storage.setItem("purpleberg.t2", JSON.stringify({ a: 5 }));
  const s = createStore("t2", { a: 1, c: "x" }, { storage, debounceMs: 0 });
  assert.deepEqual(s.get(), { a: 5, c: "x" });
});

test("ignores corrupt JSON and non-object payloads", () => {
  const storage = memoryStorage();
  storage.setItem("purpleberg.t3", "{nope");
  assert.deepEqual(createStore("t3", { a: 1 }, { storage, debounceMs: 0 }).get(), { a: 1 });
  storage.setItem("purpleberg.t3", "42");
  assert.deepEqual(createStore("t3", { a: 1 }, { storage, debounceMs: 0 }).get(), { a: 1 });
});

test("migrate runs only when nothing usable is stored", () => {
  const storage = memoryStorage();
  storage.setItem("old_key", "light");
  const migrate = (st) => (st.getItem("old_key") ? { theme: st.getItem("old_key") } : null);
  const s = createStore("t4", { theme: "dark" }, { storage, debounceMs: 0, migrate });
  assert.equal(s.get().theme, "light");
  s.set({ theme: "dark" });
  const again = createStore("t4", { theme: "dark" }, { storage, debounceMs: 0, migrate: () => ({ theme: "system" }) });
  assert.equal(again.get().theme, "dark");
});

test("update, subscribe, unsubscribe", () => {
  const s = createStore("t5", { n: 0 }, { storage: null });
  const seen = [];
  const off = s.subscribe((st) => seen.push(st.n));
  s.update((st) => ({ n: st.n + 1 }));
  s.update((st) => ({ n: st.n + 1 }));
  off();
  s.update((st) => ({ n: st.n + 1 }));
  assert.deepEqual(seen, [1, 2]);
  assert.equal(s.get().n, 3);
});

test("reset returns to initial; replace merges over initial", () => {
  const storage = memoryStorage();
  const s = createStore("t6", { a: 1, b: 2 }, { storage, debounceMs: 0 });
  s.set({ a: 9, b: 9 });
  s.reset();
  assert.deepEqual(s.get(), { a: 1, b: 2 });
  assert.equal(storage.getItem("purpleberg.t6"), JSON.stringify({ a: 1, b: 2 }));
  s.replace({ b: 7 });
  assert.deepEqual(s.get(), { a: 1, b: 7 });
});

test("initial is cloned so callers cannot mutate it through the store", () => {
  const initial = { list: [] };
  const s = createStore("t7", initial, { storage: null });
  s.get().list.push(1);
  assert.deepEqual(initial.list, []);
});

test("a migration is persisted at once and a rehydrate never re-runs it", () => {
  const storage = memoryStorage();
  storage.setItem("old_key", "light");
  const migrate = (st) => (st.getItem("old_key") ? { theme: st.getItem("old_key") } : null);
  const s = createStore("t8", { theme: "dark" }, { storage, debounceMs: 0, migrate });
  assert.equal(s.get().theme, "light");
  assert.equal(storage.getItem("purpleberg.t8"), JSON.stringify({ theme: "light" }));
  storage.removeItem("purpleberg.t8");
  s.rehydrate();
  assert.equal(s.get().theme, "dark");
});

test("sanitize runs on hydrate, replace, and reset", () => {
  const storage = memoryStorage();
  storage.setItem("purpleberg.t9", JSON.stringify({ n: "x", junk: 1 }));
  const sanitize = (st) => ({ n: Number.isInteger(st.n) ? st.n : 1 });
  const s = createStore("t9", { n: 1 }, { storage, debounceMs: 0, sanitize });
  assert.deepEqual(s.get(), { n: 1 });
  s.replace({ n: 5.5, junk: true });
  assert.deepEqual(s.get(), { n: 1 });
  s.replace({ n: 7 });
  assert.deepEqual(s.get(), { n: 7 });
  s.reset();
  assert.deepEqual(s.get(), { n: 1 });
});

test("flush persists a pending debounced write; rehydrate keeps a newer local write", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const storage = memoryStorage();
  const s = createStore("t10", { n: 0 }, { storage, debounceMs: 100 });
  s.set({ n: 42 });
  assert.equal(storage.getItem("purpleberg.t10"), null);
  storage.setItem("purpleberg.t10", JSON.stringify({ n: 7 }));
  s.rehydrate();
  assert.equal(s.get().n, 42);
  assert.equal(storage.getItem("purpleberg.t10"), JSON.stringify({ n: 42 }));
  s.set({ n: 43 });
  s.flush();
  assert.equal(storage.getItem("purpleberg.t10"), JSON.stringify({ n: 43 }));
  mock.timers.tick(200);
  assert.equal(storage.getItem("purpleberg.t10"), JSON.stringify({ n: 43 }));
  mock.timers.reset();
});

test("a throwing subscriber does not stop the others; set ignores non-objects", () => {
  const restore = mock.method(console, "error", () => {});
  const s = createStore("t11", { n: 0 }, { storage: null });
  const seen = [];
  s.subscribe(() => { throw new Error("boom"); });
  s.subscribe((st) => seen.push(st.n));
  s.set({ n: 1 });
  assert.deepEqual(seen, [1]);
  s.set(null);
  s.set([1, 2]);
  assert.equal(s.get().n, 1);
  restore.mock.restore();
});
