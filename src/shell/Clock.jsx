import { useNow } from "../ui/useNow.js";
import { fmtClock } from "../lib/format.js";

export function Clock() {
  const now = useNow();
  return <span className="pb-clock" aria-label="Local time">{fmtClock(new Date(now))}</span>;
}
