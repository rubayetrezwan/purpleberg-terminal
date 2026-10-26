// Number, date, and time formatting shared by every screen. Pure, no React.

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Infinity is missing too: a division by a zero base must read "—", not
// "+Infinity%".
const missing = (n) => n == null || n === "" || !Number.isFinite(Number(n));

// Round to `d` places before formatting, so a value that rounds to zero
// prints "0.00" rather than "-0.00".
const rounded = (n, d) => {
  const v = Number(Number(n).toFixed(d));
  return Object.is(v, -0) ? 0 : v;
};

// Fixed decimals, no grouping (tables that must stay narrow).
export const fmt = (n, d = 2) => (missing(n) ? "—" : rounded(n, d).toFixed(d));

// Fixed decimals with thousands separators (prices, headline numbers).
export const fmtNum = (n, d = 2) =>
  missing(n)
    ? "—"
    : rounded(n, d).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// A price level (a 52-week bound, a target) at the precision it needs: whole
// numbers from 100 up, cents below that, four places under a dollar. A $1.05
// stock's range then reads "0.45 – 1.20", not "0 – 1".
export const fmtLevel = (n) => {
  if (missing(n)) return "—";
  const a = Math.abs(Number(n));
  return fmtNum(n, a >= 100 ? 0 : a >= 1 ? 2 : 4);
};

// Magnitude abbreviation. Abbreviates on |n| so negatives collapse too, and
// promotes to the next unit when rounding would print "1000.0K".
const BANDS = [[1e12, "T", 2], [1e9, "B", 1], [1e6, "M", 1], [1e3, "K", 1]];
export const fmtK = (n) => {
  if (missing(n)) return "—";
  const v = Number(n);
  if (v === 0) return "0";
  const neg = v < 0;
  const a = Math.abs(v);
  let out = null;
  for (let i = 0; i < BANDS.length && out == null; i += 1) {
    const [div, suffix, d] = BANDS[i];
    if (a < div) continue;
    const s = (a / div).toFixed(d);
    if (Number(s) >= 1000 && i > 0) {
      const [pdiv, psuffix, pd] = BANDS[i - 1];
      out = (a / pdiv).toFixed(pd) + psuffix;
    } else {
      out = s + suffix;
    }
  }
  if (out == null) out = a.toString();
  return neg ? "-" + out : out;
};

export const fmtSigned = (n, d = 2) => {
  if (missing(n)) return "—";
  const v = rounded(n, d);
  return (v > 0 ? "+" : "") + v.toFixed(d);
};

export const fmtPct = (n, d = 2) => (missing(n) ? "—" : fmtSigned(n, d) + "%");

// "14:18:53" in any IANA zone; formatters are cached because the session
// clock calls this every second for three zones.
const clockFormatters = new Map();
export const fmtClock = (date, timeZone) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  const tz = timeZone || undefined;
  const key = tz || "local";
  let f = clockFormatters.get(key);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      f = null; // unknown zone: remembered so a live clock does not retry every second
    }
    clockFormatters.set(key, f);
  }
  return f ? f.format(date) : "—";
};

export const ts = () => fmtClock(new Date());

// Coarse age: 9s, 2m, 1h, 2d.
export function fmtAgo(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// h:mm:ss countdown, clamped at zero. From a day out it reads in units
// ("1D 00H 13M"): "1D 00:13:51" looked like a clock time, and seconds a day
// away are noise.
export function fmtCountdown(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, "0");
  if (d) return `${d}D ${p(h)}H ${p(m)}M`;
  return `${h}:${p(m)}:${p(s)}`;
}

// Table dates: "2026-09-04" -> "04 SEP 26".
export function fmtDateTable(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const mon = MONTHS_SHORT[Number(m) - 1];
  if (!mon) return iso;
  return `${d} ${mon.toUpperCase()} ${y.slice(-2)}`;
}

// Axis tick: "Mar 14" normally; "Mar '25" when showYear is set (multi-year ranges).
export const fmtAxisDate = (iso, showYear) => {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mon = MONTHS_SHORT[parseInt(m, 10) - 1] || m;
  return showYear ? `${mon} '${y.slice(-2)}` : `${mon} ${parseInt(d, 10)}`;
};

// Tooltip label: full "Mar 14, 2025".
export const fmtTooltipDate = (iso) => {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  const mon = MONTHS_SHORT[parseInt(m, 10) - 1] || m;
  return `${mon} ${parseInt(d, 10)}, ${y}`;
};

const pad2 = (n) => String(n).padStart(2, "0");

// Short name of the user's own zone ("GMT+6"). Headline times are on this
// clock, and the section meta says so once rather than on every row.
export const LOCAL_TZ = (() => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
    return (parts.find((p) => p.type === "timeZoneName")?.value || "LOCAL").toUpperCase();
  } catch {
    return "LOCAL";
  }
})();

// Headline time on the user's clock: "19:06" for today, "24 OCT 19:06" for
// anything older, so last night's 19:06 is never read as this evening's.
export function fmtNewsTime(sec, now = new Date()) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const d = new Date(n * 1000);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${hm}`;
}
