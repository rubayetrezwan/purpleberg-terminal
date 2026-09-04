// NYSE full-day closures and 13:00 ET early closes. Extend by adding dates.
// Sources: NYSE holiday calendar. Observed dates already applied (e.g. 2026-07-03
// for Independence Day on a Saturday, 2027-12-24 for Christmas on a Saturday).
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

export const NYSE_EARLY_CLOSES = new Set([
  "2026-11-27", "2026-12-24",
  "2027-11-26",
]);
