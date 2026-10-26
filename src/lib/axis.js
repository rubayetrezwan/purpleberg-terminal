// Tick placement for chart axes. Pure, no React.

// Recharts' "auto" domain picks whatever step splits the data range evenly,
// which gave a month of USD/JPY ticks 0.55 apart (156.75, 157.30, 157.85).
// A step of 1, 2, 2.5 or 5 times a power of ten can be read at a glance.
const STEPS = [1, 2, 2.5, 5, 10];

// Decimals a step needs so neighbouring ticks never print the same number:
// 0.25 needs 2, 50 needs 0, 2.5 needs 1.
export function stepDecimals(step) {
  if (!(step > 0)) return 0;
  for (let d = 0; d <= 10; d += 1) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 10;
}

// Round ticks covering every finite value, about `count` of them. Returns
// null for no data. The domain is snapped to the outer ticks so the axis
// ends on a labelled line instead of an unlabelled gap.
export function niceTicks(values, count = 5) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values || []) {
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n < lo) lo = n;
    if (n > hi) hi = n;
  }
  if (!Number.isFinite(lo)) return null;
  if (lo === hi) {
    // A flat series still needs a band to sit in.
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  // The small epsilon keeps a value sitting exactly on a tick (100 with a step
  // of 50) from adding a whole empty step to the axis through float error.
  const span = (s) => [Math.floor(lo / s + 1e-9), Math.ceil(hi / s - 1e-9)];
  // The round step whose tick count lands nearest `count`; on a tie the finer
  // step wins, since it hugs the data more tightly.
  let step = null;
  let best = Infinity;
  for (const s of [0.5, ...STEPS].map((k) => k * mag)) {
    const [a, b] = span(s);
    const miss = Math.abs(b - a + 1 - count);
    if (miss < best) { best = miss; step = s; }
  }
  const decimals = stepDecimals(step);
  const [first, last] = span(step);
  const ticks = [];
  for (let i = first; i <= last; i += 1) ticks.push(Number((i * step).toFixed(decimals)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, step, decimals };
}

// Every Nth row of a long series, for drawing only: ten years of daily crypto
// closes is 3,650 points on a chart a thousand pixels wide. Anything that
// measures (period returns) must use the full series, since thinned rows no
// longer sit one day apart. The latest row is always kept so the line ends
// on the current close.
export function thinForDrawing(rows, max = 600) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length <= max) return list;
  const stride = Math.ceil(list.length / max);
  const out = [];
  // Counted back from the end, so the kept rows are evenly spaced up to and
  // including the latest one.
  for (let i = (list.length - 1) % stride; i < list.length; i += stride) out.push(list[i]);
  return out;
}

// Month-start ticks for a daily series dated "YYYY-MM-DD", at most `max` of
// them. Ticks spaced by row count landed twice in one month on a year of
// data, so the axis read "Dec '25 Dec '25". The partial month at the left
// edge is skipped; longer ranges label every 2nd, 3rd, 6th or 12th month.
export function monthTicks(dates, max = 12) {
  const starts = [];
  let prev = null;
  for (const d of dates || []) {
    if (typeof d !== "string" || d.length < 7) continue;
    const ym = d.slice(0, 7);
    if (prev !== null && ym !== prev) starts.push(d);
    prev = ym;
  }
  if (starts.length <= max) return starts;
  const every = [2, 3, 6, 12, 24].find((n) => Math.ceil(starts.length / n) <= max) || 24;
  // Keep months that fall on the stride (Jan and Jul for 6, Jan of even years
  // for 24), not every Nth month counted from wherever the window starts.
  return starts.filter((d) => (Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1) % every === 0);
}
