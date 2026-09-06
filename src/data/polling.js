// Every poll interval scales with Settings > Data > Refresh (10, 15, 30, 60s),
// relative to the 15s the hooks were tuned for. 5s floor protects the proxy.
export function scaleInterval(baseMs, refreshSec) {
  const factor = (Number(refreshSec) || 15) / 15;
  return Math.max(5000, Math.round(baseMs * factor));
}
