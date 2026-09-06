// Confirmation dialog state. `confirm()` resolves true or false; DialogHost renders it.
let pending = null;
const listeners = new Set();

function emit() { for (const fn of listeners) fn(); }

export function getDialog() { return pending; }
export function subscribeDialog(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function confirm({ title, body = "", confirmLabel = "CONFIRM", cancelLabel = "CANCEL", danger = false }) {
  return new Promise((resolve) => {
    if (pending) pending.resolve(false);
    pending = { title, body, confirmLabel, cancelLabel, danger, resolve };
    emit();
  });
}

export function settleDialog(result) {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.resolve(result);
}
