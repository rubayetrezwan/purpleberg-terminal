import { NYSE_HOLIDAYS, NYSE_EARLY_CLOSES, HOLIDAY_TABLE_THROUGH } from "./marketHolidays.js";

// NYSE session state from wall-clock time. Uses Intl for the New York zone so
// DST needs no tables; holidays and early closes come from marketHolidays.js.
export const ET = "America/New_York";
const PRE_MIN = 4 * 60;
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const EARLY_CLOSE_MIN = 13 * 60;
const POST_END_MIN = 20 * 60;

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Calendar fields of an instant as seen in New York.
export function etParts(date) {
  const p = {};
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

// Minutes to add to UTC to get New York time at this instant (-240 or -300).
export function etOffsetMinutes(date) {
  const p = etParts(date);
  const [y, m, d] = p.ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// The instant at `minutes` past New York midnight on `ymd`. Two passes so the
// offset in force at the target time is used on DST switch days.
// A wall time that does not exist on spring-forward day (02:00 to 02:59) maps
// to the hour before; no session boundary falls in that gap.
export function etInstant(ymd, minutes) {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0);
  const first = new Date(naive - etOffsetMinutes(new Date(naive)) * 60000);
  return new Date(naive - etOffsetMinutes(first) * 60000);
}

export function isTradingDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd !== 0 && wd !== 6 && !NYSE_HOLIDAYS.has(ymd);
}

export function nextTradingDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d);
  let firstWeekday = null;
  for (let i = 0; i < 14; i += 1) {
    t += 86_400_000;
    const dt = new Date(t);
    const s = dt.toISOString().slice(0, 10);
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (!NYSE_HOLIDAYS.has(s)) return s;
    if (!firstWeekday) firstWeekday = s;
  }
  // The exchange never closes for two weeks; if the table says otherwise,
  // trust the weekday calendar over the table so callers never get null.
  return firstWeekday;
}

let warnedStaleTable = false;

export function nyseSession(now = new Date()) {
  const p = etParts(now);
  const trading = isTradingDay(p.ymd);
  const early = NYSE_EARLY_CLOSES.has(p.ymd);
  const closeMin = early ? EARLY_CLOSE_MIN : CLOSE_MIN;
  const t = p.hour * 60 + p.minute + p.second / 60;
  const tableStale = p.ymd > HOLIDAY_TABLE_THROUGH;
  if (tableStale && !warnedStaleTable) {
    warnedStaleTable = true;
    console.warn(`[session] NYSE holiday table ends ${HOLIDAY_TABLE_THROUGH}; extend src/lib/marketHolidays.js`);
  }

  let state = "closed";
  if (trading) {
    if (t >= PRE_MIN && t < OPEN_MIN) state = "pre";
    else if (t >= OPEN_MIN && t < closeMin) state = "open";
    else if (t >= closeMin && t < POST_END_MIN) state = "post";
  }

  let countdownTo;
  if (state === "open") countdownTo = etInstant(p.ymd, closeMin);
  else if (state === "pre" || (trading && t < PRE_MIN)) countdownTo = etInstant(p.ymd, OPEN_MIN);
  else countdownTo = etInstant(nextTradingDay(p.ymd), OPEN_MIN);

  return { state, early, ymd: p.ymd, countdownTo, countdownLabel: state === "open" ? "closes" : "opens", tableStale };
}

// Yahoo's marketState on ^GSPC, when present, is the ground truth for the label.
export function stateFromMarketState(ms) {
  if (ms === "REGULAR") return "open";
  if (ms === "PRE") return "pre";
  if (ms === "POST") return "post";
  if (typeof ms === "string" && ms) return "closed";
  return null;
}

export const SESSION_LABELS = {
  open: "NYSE OPEN",
  pre: "NYSE PRE-MKT",
  post: "NYSE AFTER HRS",
  closed: "NYSE CLOSED",
};

export const WORLD_CLOCKS = [
  { label: "NEW YORK", tz: "America/New_York" },
  { label: "LONDON", tz: "Europe/London" },
  { label: "TOKYO", tz: "Asia/Tokyo" },
];
