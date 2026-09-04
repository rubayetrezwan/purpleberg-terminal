import { fmt } from "../lib/format.js";
import { PERIOD_ORDER } from "../lib/returns.js";
import { EmptyState } from "./EmptyState.jsx";

// Period returns as signed bars either side of a centre line. Clamped at
// 50% so one outlier period cannot flatten the rest.
export function PeriodReturns({ returns, note }) {
  const rows = PERIOD_ORDER.filter((k) => returns[k] != null);
  if (!rows.length) return <EmptyState>SELECT A LONGER RANGE TO COMPUTE RETURNS</EmptyState>;
  return (
    <div className="pb-per">
      {rows.map((key) => {
        const v = returns[key];
        const w = Math.min(Math.abs(v), 50);
        return (
          <div key={key} className="pb-per__row">
            <div className="pb-per__head">
              <span className="pb-label">{key}</span>
              <span className={`pb-per__val ${v >= 0 ? "pb-up" : "pb-down"}`}>{v >= 0 ? "+" : ""}{fmt(v)}%</span>
            </div>
            <div className="pb-per__track">
              <span className="pb-per__zero" aria-hidden="true" />
              <i
                className={v >= 0 ? "pb-per__fill" : "pb-per__fill pb-per__fill--down"}
                style={{ left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
      {note && <div className="pb-form__hint pb-muted">{note}</div>}
    </div>
  );
}
