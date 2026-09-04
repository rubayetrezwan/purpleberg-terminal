import { useMemo, useState } from "react";
import { useNow } from "../ui/useNow.js";
import { useLayer } from "../ui/useLayer.js";
import { useQuote } from "../data/quotePool.jsx";
import { nyseSession, stateFromMarketState, SESSION_LABELS, WORLD_CLOCKS } from "../lib/session.js";
import { HOLIDAY_TABLE_THROUGH } from "../lib/marketHolidays.js";
import { fmtClock, fmtCountdown } from "../lib/format.js";

// NYSE state with a countdown; click for New York, London, Tokyo clocks.
export function SessionClock({ compact = false }) {
  const now = useNow();
  const spx = useQuote("^GSPC");
  const session = useMemo(() => nyseSession(new Date(now)), [now]);
  const state = stateFromMarketState(spx ? spx.marketState : undefined) ?? session.state;
  const [open, setOpen] = useState(false);
  useLayer(open, () => setOpen(false));
  const remaining = session.countdownTo.getTime() - now;
  return (
    <div className="pb-session">
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
