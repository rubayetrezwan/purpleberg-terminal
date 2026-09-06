export const FEED_INITIAL = { status: "online", failures: 0, since: null };

// Two consecutive failed polls flip the feed offline; one success flips it
// back. Once offline, further failures return the same object so consumers
// do not re-render every poll for the whole outage.
export function nextFeedState(prev, ok, now = Date.now()) {
  if (ok) {
    if (prev.status === "online" && prev.failures === 0) return prev;
    return { status: "online", failures: 0, since: null };
  }
  if (prev.status === "offline") return prev;
  const failures = prev.failures + 1;
  if (failures >= 2) return { status: "offline", failures, since: now };
  return { ...prev, failures };
}
