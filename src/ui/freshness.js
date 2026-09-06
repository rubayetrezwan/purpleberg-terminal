import { fmtAgo } from "../lib/format.js";

// "9s ago" while fresh; amber "STALE 2m" once older than 3 polls (45s floor);
// "OFFLINE" whenever the feed status says the proxy stopped answering.
export function freshnessState(updatedAt, now, intervalMs = 15000, online = true) {
  if (!online) return { label: "OFFLINE", tone: "warn", stale: true };
  if (updatedAt == null) return { label: "LOADING…", tone: "muted", stale: false };
  const age = Math.max(0, now - updatedAt);
  const stale = age > Math.max(3 * intervalMs, 45_000);
  if (stale) return { label: `STALE ${fmtAgo(age)}`, tone: "warn", stale: true };
  return { label: `${fmtAgo(age)} ago`, tone: "muted", stale: false };
}
