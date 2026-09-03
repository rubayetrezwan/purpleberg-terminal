export function resolveTheme(pref, systemDark) {
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system") return systemDark ? "dark" : "light";
  return "dark";
}

export function resolveDensity(pref) {
  return pref === "comfortable" ? "comfortable" : "compact";
}
