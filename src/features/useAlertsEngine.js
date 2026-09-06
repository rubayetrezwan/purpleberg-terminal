import { useEffect } from "react";
import { useQuotePool } from "../data/quotePool.jsx";
import { useStore } from "../stores/useStore.js";
import { alerts, replaceAlertItems, rearmAlert } from "../stores/alerts.js";
import { settings } from "../stores/settings.js";
import { evaluateAlerts } from "../lib/alerts.js";
import { toast } from "../ui/toasts.js";
import { fmtNum, fmtClock } from "../lib/format.js";

// Runs once at the app root. Re-evaluates every alert on each quote-pool update.
export function useAlertsEngine() {
  const pool = useQuotePool();
  const items = useStore(alerts, (s) => s.items);
  const notify = useStore(settings, (s) => s.notifications);

  useEffect(() => {
    if (!items.length || !pool.bySymbol.size) return;
    const { fired, next } = evaluateAlerts(items, (sym) => pool.bySymbol.get(sym)?.price ?? null);
    if (next !== items) replaceAlertItems(next);
    for (const a of fired) {
      const title = `ALERT · ${a.symbol} ${a.op === "above" ? "ABOVE" : "BELOW"} ${fmtNum(a.price)}`;
      const body = `LAST ${fmtNum(a.triggeredPrice)} · ${fmtClock(new Date(a.triggeredAt))}`;
      toast({ tone: "warn", title, body, sticky: true, actions: [{ label: "RE-ARM", run: () => rearmAlert(a.id, a.triggeredPrice) }] });
      if (notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(title, { body }); } catch { /* notifications blocked */ }
      }
    }
  }, [pool.bySymbol, items, notify]);
}
