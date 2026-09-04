export const FEED_INITIAL = { status: "online", failures: 0, since: null };

// Two consecutive failed polls flip the feed offline; one success flips it back.
export function nextFeedState(prev, ok, now = Date.now()) {
  if (ok) {
    if (prev.status === "online" && prev.failures === 0) return prev;
    return { status: "online", failures: 0, since: null };
  }
  const failures = prev.failures + 1;
  if (failures >= 2 && prev.status !== "offline") return { status: "offline", failures, since: now };
  return { ...prev, failures };
}
