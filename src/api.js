const BASE = "/api";

async function get(url) {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

export const api = {
  quotes: (symbols) =>
    get(`/quotes?symbols=${symbols.join(",")}`),

  historical: (symbol, range = "3mo", interval = "1d") =>
    get(`/historical/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`),

  financials: (symbol) =>
    get(`/financials/${encodeURIComponent(symbol)}`),

  news: (symbols) =>
    get(`/news${symbols ? `?symbols=${symbols.join(",")}` : ""}`),

  econCalendar: () => get("/econ-calendar"),

  treasuryRates: () => get("/treasury-rates"),

  search: (query) =>
    get(`/search?q=${encodeURIComponent(query)}`),

  chat: async (messages) => {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    return res.json();
  },
};
