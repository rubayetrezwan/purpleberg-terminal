// Alert evaluation. An alert fires when its condition holds for the current
// price and did not hold for the reference price: the last price we recorded
// on the other side of the threshold, or the baseline captured at creation or
// re-arm. That is crossing semantics: an alert created while already above its
// target waits for a dip and a return. The reference is only rewritten when
// the price changes sides, so a quiet poll leaves the store untouched.

export function conditionHolds(op, price, target) {
  return op === "below" ? price <= target : price >= target;
}

const usable = (price) => Number.isFinite(price) && price > 0;

// items: alert store items. getPrice: (symbol) => number | null.
// Returns { fired, next }; `next` is the same array when nothing changed.
export function evaluateAlerts(items, getPrice, now = Date.now()) {
  const fired = [];
  let changed = false;
  const next = items.map((a) => {
    const price = getPrice(a.symbol);
    if (!usable(price) || a.triggeredAt != null) return a;
    const ref = a.lastPrice ?? a.baseline;
    if (ref == null) {
      // No reference yet (created without a live quote): arm on this price.
      changed = true;
      return { ...a, lastPrice: price };
    }
    const holdsNow = conditionHolds(a.op, price, a.price);
    const heldBefore = conditionHolds(a.op, ref, a.price);
    if (holdsNow && !heldBefore) {
      changed = true;
      const t = { ...a, triggeredAt: now, triggeredPrice: price, lastPrice: price };
      fired.push(t);
      return t;
    }
    if (holdsNow !== heldBefore) {
      // Crossed back to the far side: remember it so the next return fires.
      changed = true;
      return { ...a, lastPrice: price };
    }
    return a;
  });
  return { fired, next: changed ? next : items };
}
