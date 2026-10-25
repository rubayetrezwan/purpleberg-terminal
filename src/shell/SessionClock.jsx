import { useMemo, useRef, useState } from "react";
import { useNow } from "../ui/useNow.js";
import { useLayer } from "../ui/useLayer.js";
import { freshnessState } from "../ui/freshness.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { nyseSession, displayState, SESSION_LABELS, WORLD_CLOCKS } from "../lib/session.js";
import { HOLIDAY_TABLE_THROUGH } from "../lib/marketHolidays.js";
import { fmtClock, fmtCountdown } from "../lib/format.js";

// NYSE state with a countdown; click for New York, London, Tokyo clocks.
export function SessionClock({ compact = false }) {
  const now = useNow();
  const pool = useQuotePool();
  const spx = pool.bySymbol.get("^GSPC") ?? null;
  const session = useMemo(() => nyseSession(new Date(now)), [now]);
  // Fresh by the same rule as the tape's freshness badge, so the label stops
  // trusting Yahoo exactly when the tape turns STALE.
  const fresh = pool.updatedAt != null && !freshnessState(pool.updatedAt, now, pool.intervalMs).stale;
  const state = displayState(session.state, spx ? spx.marketState : undefined, fresh);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useLayer(open, () => setOpen(false), { modal: false, ref });
  const remaining = session.countdownTo.getTime() - now;
  return (
    <div className="pb-session" ref={ref}>
      <button type="button" className="pb-reset pb-session__btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Session and world clocks">
        <span className={`pb-session__dot pb-session__dot--${state}`} aria-hidden="true" />
        <span className="pb-session__label">{compact ? state.toUpperCase() : SESSION_LABELS[state]}</span>
        {!compact && <span className="pb-session__cd pb-muted">{session.countdownLabel} {fmtCountdown(remaining)}</span>}
      </button>
      {open && (
        <div className="pb-pop pb-session__pop" role="dialog" aria-label="World clocks">
          {WORLD_CLOCKS.map((c) => (
            <div key={c.tz} className="pb-kv"><span className="pb-kv__k">{c.label}</span><span className="pb-kv__v">{fmtClock(new Date(now), c.tz)}</span></div>
          ))}
          <div className="pb-kv"><span className="pb-kv__k">NYSE</span><span className="pb-kv__v">{SESSION_LABELS[state]} · {session.countdownLabel} {fmtCountdown(remaining)}</span></div>
          {session.early && <div className="pb-session__note pb-warn">EARLY CLOSE 13:00 ET</div>}
          {session.tableStale && <div className="pb-session__note pb-warn">HOLIDAY CALENDAR ENDS {HOLIDAY_TABLE_THROUGH}</div>}
        </div>
      )}
    </div>
  );
}
