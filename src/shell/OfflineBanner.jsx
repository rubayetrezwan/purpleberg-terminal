import { useEffect, useRef } from "react";
import { useStore } from "../stores/useStore.js";
import { feedStatus } from "../data/feedStatus.js";
import { useQuotePool } from "../data/quotePool.jsx";
import { toast } from "../ui/toasts.js";
import { fmtClock } from "../lib/format.js";

export function OfflineBanner() {
  const status = useStore(feedStatus, (s) => s.status);
  const since = useStore(feedStatus, (s) => s.since);
  const pool = useQuotePool();
  const prev = useRef(status);
  useEffect(() => {
    if (prev.current === status) return;
    prev.current = status;
    if (status === "offline") toast({ tone: "warn", title: "DATA FEED OFFLINE", body: "Showing last known values." });
    else toast({ title: "DATA FEED BACK ONLINE" });
  }, [status]);
  if (status !== "offline") return null;
  return (
    <div className="pb-offline" role="alert">
      <span>DATA FEED UNREACHABLE{since ? ` SINCE ${fmtClock(new Date(since))}` : ""} · SHOWING LAST KNOWN VALUES</span>
      <button type="button" className="pb-reset pb-offline__retry" onClick={pool.refetch}>RETRY</button>
    </div>
  );
}
