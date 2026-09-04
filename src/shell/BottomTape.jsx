import { useMemo } from "react";
import { useQuotePool } from "../data/quotePool.jsx";
import { Price } from "../ui/Price.jsx";
import { Change } from "../ui/Change.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { fmtNum } from "../lib/format.js";

// Scrolling tape of the 20 largest tracked names plus the status cluster.
export function BottomTape() {
  const pool = useQuotePool();
  const tape = useMemo(
    () => pool.equities.filter((q) => q.price > 0).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, 20),
    [pool.equities]
  );
  return (
    <footer className="pb-tape" aria-label="Price tape and feed status">
      <div className="pb-tape__viewport">
        <div className="pb-tape__scroll" style={{ animationPlayState: tape.length ? "running" : "paused" }}>
          {[...tape, ...tape].map((q, i) => (
            <span key={`${q.symbol}-${i}`} className="pb-tape__item">
              <span className="pb-muted">{q.symbol}</span>
              <Price value={q.price} format={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} />
              <Change value={q.changePercent} />
            </span>
          ))}
        </div>
      </div>
      <div className="pb-tape__status">
        <span>{pool.equities.length} QUOTES</span>
        <span className="pb-muted">·</span>
        <Freshness updatedAt={pool.updatedAt} intervalMs={pool.intervalMs} />
      </div>
    </footer>
  );
}
