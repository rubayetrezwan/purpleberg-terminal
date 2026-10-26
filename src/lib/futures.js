// Futures helpers for the continuous front-month ("=F") series. Pure, no React.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Yahoo names the front month verbosely ("Crude Oil May 26", "Chicago SRW
// Wheat Futures,May-2026") and cuts long names short, so wheat arrives as
// "Chicago SRW Wheat Futures,Dec-2". A cut-off year is completed from the
// clock: a front month is never more than a month in the past, so it is the
// first year matching the digits Yahoo kept in which the month has not long
// gone. Returns "DEC '26", or "" when no month can be read.
const MONTH_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]?(\d{1,4})\b/i;
export function contractMonth(longName, now = new Date()) {
  if (!longName) return "";
  const m = String(longName).match(MONTH_RE);
  if (!m) return "";
  const mon = MONTHS.indexOf(m[1].slice(0, 3).toUpperCase());
  const digits = m[2];
  let year = null;
  if (digits.length === 4) year = Number(digits);
  else if (digits.length === 2) year = 2000 + Number(digits);
  else {
    const nowYear = now.getUTCFullYear();
    const nowIndex = nowYear * 12 + now.getUTCMonth();
    for (let y = nowYear - 1; y <= nowYear + 10; y += 1) {
      if (!String(y).startsWith(digits)) continue;
      if (y * 12 + mon >= nowIndex - 1) { year = y; break; }
    }
  }
  if (year == null) return "";
  return `${MONTHS[mon]} '${String(year).slice(-2)}`;
}

// True when a daily series has a stretch of at least `days` sessions trading
// under 5% of its median volume. Yahoo keeps quoting the expiring contract
// through its delivery period while the volume has already moved to the next
// one, so the volume chart shows near-empty runs that look like missing data.
export function hasRollLull(rows, days = 3) {
  const vols = (Array.isArray(rows) ? rows : []).map((r) => Number(r && r.volume) || 0);
  const positive = vols.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length < days * 2) return false;
  const median = positive[Math.floor(positive.length / 2)];
  let run = 0;
  for (const v of vols) {
    run = v < median * 0.05 ? run + 1 : 0;
    if (run >= days) return true;
  }
  return false;
}
