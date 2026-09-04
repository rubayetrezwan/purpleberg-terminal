import { createStore } from "../stores/createStore.js";

// Ad-hoc symbols (quick-look on something outside the tracked 250) held in the
// quote pool for as long as at least one component retains them.
export const poolExtras = createStore("poolExtras", { counts: {} }, { storage: null, debounceMs: 0 });

export function retainSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  if (!s) return;
  poolExtras.update((st) => ({ counts: { ...st.counts, [s]: (st.counts[s] || 0) + 1 } }));
}

export function releaseSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  poolExtras.update((st) => {
    const n = (st.counts[s] || 0) - 1;
    const counts = { ...st.counts };
    if (n <= 0) delete counts[s]; else counts[s] = n;
    return { counts };
  });
}
