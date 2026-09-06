// Pure path matching for the in-house router. Patterns look like
// "/equities/:symbol?" - static segments, ":name" params, "?" for optional.

export function compilePattern(pattern) {
  return pattern
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(":")) {
        const optional = seg.endsWith("?");
        return { type: "param", name: seg.slice(1, optional ? -1 : undefined), optional };
      }
      return { type: "static", value: seg };
    });
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Optional params must be trailing: matching does not backtrack, so a pattern
// like "/a/:id?/b" would never match "/a/b".
export function matchPath(pattern, path) {
  const segs = compilePattern(pattern);
  const parts = String(path || "/").split("/").filter(Boolean).map(safeDecode);
  const params = {};
  let i = 0;
  for (const seg of segs) {
    const part = parts[i];
    if (seg.type === "static") {
      if (part !== seg.value) return null;
      i += 1;
    } else if (part !== undefined) {
      params[seg.name] = part;
      i += 1;
    } else if (!seg.optional) {
      return null;
    }
  }
  if (i !== parts.length) return null;
  return params;
}

export function parseQuery(search) {
  const out = {};
  const usp = new URLSearchParams(search || "");
  for (const [k, v] of usp) out[k] = v;
  return out;
}

export function matchRoute(routes, path, search) {
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) return { route, params, query: parseQuery(search) };
  }
  return null;
}

export function buildQuery(query = {}) {
  return Object.entries(query)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function buildPath(pattern, params = {}, query = {}) {
  const parts = [];
  for (const seg of compilePattern(pattern)) {
    if (seg.type === "static") {
      parts.push(seg.value);
      continue;
    }
    const v = params[seg.name];
    if (v == null || v === "") {
      if (!seg.optional) throw new Error(`missing param ${seg.name}`);
      continue;
    }
    parts.push(encodeURIComponent(String(v)));
  }
  const qs = buildQuery(query);
  return "/" + parts.join("/") + (qs ? "?" + qs : "");
}
