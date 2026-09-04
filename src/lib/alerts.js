// Alert evaluation. An alert fires when its condition holds for the current
// price and did not hold for the last price we saw (or the baseline recorded
// at creation or re-arm). That is crossing semantics: an alert created while
// already above its target waits for a dip and a return.

export function conditionHolds(op, price, target) {
  return op === "below" ? price <= target : price >= target;
}

// items: alert store items. getPrice: (symbol) => number | null.
// Returns { fired, next }; `next` is the same array when nothing changed.
export function evaluateAlerts(items, getPrice, now = Date.now()) {
  const fired = [];
  let changed = false;
  const next = items.map((a) => {
    const price = getPrice(a.symbol);
    if (!(price > 0) || a.triggeredAt) return a;
    const ref = a.lastPrice ?? a.baseline;
    const holdsNow = conditionHolds(a.op, price, a.price);
    const heldBefore = ref != null && conditionHolds(a.op, ref, a.price);
    if (holdsNow && !heldBefore) {
      changed = true;
      const t = { ...a, triggeredAt: now, triggeredPrice: price, lastPrice: price };
      fired.push(t);
      return t;
    }
    if (a.lastPrice !== price) {
      changed = true;
      return { ...a, lastPrice: price };
    }
    return a;
  });
  return { fired, next: changed ? next : items };
}
