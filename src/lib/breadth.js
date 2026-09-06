// Cross-sectional breadth of a quote list. This is a snapshot of today's
// moves, not a time series: label it as such wherever it is rendered.
export function breadth(rows = []) {
  // A null or blank change means "unknown", not "flat": Number(null) is 0,
  // so it has to be rejected before the finite check.
  const usable = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  const moves = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && usable(r.changePercent) && Number(r.price) > 0)
    .map((r) => ({ symbol: r.symbol, chg: Number(r.changePercent) }));
  if (!moves.length) {
    return { total: 0, up: 0, down: 0, flat: 0, pctUp: null, medianAbs: null, best: null, worst: null };
  }
  const up = moves.filter((m) => m.chg > 0).length;
  const down = moves.filter((m) => m.chg < 0).length;
  const sortedAbs = moves.map((m) => Math.abs(m.chg)).sort((a, b) => a - b);
  const mid = Math.floor(sortedAbs.length / 2);
  const medianAbs = sortedAbs.length % 2 ? sortedAbs[mid] : (sortedAbs[mid - 1] + sortedAbs[mid]) / 2;
  const byChg = [...moves].sort((a, b) => b.chg - a.chg);
  return {
    total: moves.length,
    up,
    down,
    flat: moves.length - up - down,
    pctUp: (up / moves.length) * 100,
    medianAbs,
    best: byChg[0],
    worst: byChg[byChg.length - 1],
  };
}
