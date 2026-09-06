import { useState } from "react";
import { Bell } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { alerts, rearmAlert, removeAlert } from "../stores/alerts.js";
import { useLayer } from "../ui/useLayer.js";
import { fmtNum, fmtClock } from "../lib/format.js";

export function AlertsBell() {
  const items = useStore(alerts, (s) => s.items);
  const [open, setOpen] = useState(false);
  useLayer(open, () => setOpen(false));
  const armed = items.filter((a) => !a.triggeredAt);
  const fired = items.filter((a) => a.triggeredAt);
  return (
    <div className="pb-bell">
      <button
        type="button"
        className={`pb-reset pb-bell__btn${fired.length ? " pb-bell__btn--fired" : ""}`}
        aria-label={`Alerts: ${armed.length} armed, ${fired.length} triggered`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={13} strokeWidth={1.5} />
        {items.length > 0 && <span className="pb-bell__count">{fired.length ? `${fired.length}!` : armed.length}</span>}
      </button>
      {open && (
        <div className="pb-pop pb-bell__pop" role="dialog" aria-label="Alerts">
          <div className="pb-pop__head">ALERTS<span className="pb-muted">{items.length ? `${armed.length} ARMED · ${fired.length} FIRED` : "NONE"}</span></div>
          {!items.length && <div className="pb-pop__empty pb-muted">Set one from any quick look (bell icon).</div>}
          {items.map((a) => (
            <div key={a.id} className="pb-alertrow">
              <span className="pb-alertrow__sym">{a.symbol}</span>
              <span className="pb-alertrow__cond">{a.op === "above" ? "≥" : "≤"} {fmtNum(a.price)}</span>
              <span className={`pb-alertrow__state ${a.triggeredAt ? "pb-warn" : "pb-muted"}`}>
                {a.triggeredAt ? `FIRED ${fmtClock(new Date(a.triggeredAt))}` : `LAST ${a.lastPrice != null ? fmtNum(a.lastPrice) : "—"}`}
              </span>
              {a.triggeredAt && <button type="button" className="pb-reset pb-alertrow__act" onClick={() => rearmAlert(a.id, a.triggeredPrice)}>RE-ARM</button>}
              <button type="button" className="pb-reset pb-alertrow__act pb-down" onClick={() => removeAlert(a.id)} aria-label={`Delete alert ${a.symbol}`}>DEL</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
