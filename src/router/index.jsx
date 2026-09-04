import { useMemo, useSyncExternalStore } from "react";
import { matchRoute, parseQuery } from "./match.js";
import { ROUTES } from "./routes.js";

// History API router. One module-level location snapshot, subscribers, and a
// popstate listener. Screens read `useRoute()`; navigation goes through
// `navigate`, `updateQuery`, or <Link>.
const listeners = new Set();

function read() {
  if (typeof window === "undefined") return { path: "/", search: "" };
  return { path: window.location.pathname, search: window.location.search };
}

let snapshot = read();

function emit() {
  snapshot = read();
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") window.addEventListener("popstate", emit);

export function getLocation() {
  return snapshot;
}

export function subscribeLocation(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function navigate(to, { replace = false } = {}) {
  if (to === snapshot.path + snapshot.search) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", to);
  emit();
}

// Merge a patch into the current query string. Null or "" removes a key.
export function updateQuery(patch, { replace = true } = {}) {
  const loc = getLocation();
  const q = parseQuery(loc.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete q[k];
    else q[k] = String(v);
  }
  const qs = new URLSearchParams(q).toString();
  navigate(loc.path + (qs ? "?" + qs : ""), { replace });
}

export function useLocation() {
  return useSyncExternalStore(subscribeLocation, getLocation, getLocation);
}

export function useRoute() {
  const loc = useLocation();
  return useMemo(() => {
    const m = matchRoute(ROUTES, loc.path, loc.search);
    if (m) return { route: m.route, params: m.params, query: m.query, path: loc.path };
    return { route: null, params: {}, query: parseQuery(loc.search), path: loc.path };
  }, [loc]);
}

export function Link({ to, replace = false, onClick, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export { pathFor, ROUTES, ALIASES, routeByName, routeByMnemonic, isMnemonic, MOBILE_TAB_NAMES } from "./routes.js";
export { parseQuery } from "./match.js";
