// Number, date, and time formatting shared by every screen. Pure, no React.

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const missing = (n) => n == null || n === "" || Number.isNaN(Number(n));

// Fixed decimals, no grouping (tables that must stay narrow).
export const fmt = (n, d = 2) => (missing(n) ? "—" : Number(n).toFixed(d));

// Fixed decimals with thousands separators (prices, headline numbers).
export const fmtNum = (n, d = 2) =>
  missing(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

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
  const v = Number(n);
  return (v > 0 ? "+" : "") + v.toFixed(d);
};

export const fmtPct = (n, d = 2) => (missing(n) ? "—" : fmtSigned(n, d) + "%");

// "14:18:53" in any IANA zone; formatters are cached because the session
// clock calls this every second for three zones.
const clockFormatters = new Map();
export const fmtClock = (date, timeZone) => {
  const key = timeZone || "local";
  let f = clockFormatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "—";
    }
    clockFormatters.set(key, f);
  }
  return f.format(date);
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

// h:mm:ss countdown, clamped at zero.
export function fmtCountdown(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
