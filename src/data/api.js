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
  // Commas stay literal: the shared poll sends about 700 symbols, and encoding
  // each separator as %2C would add 2 kB to every request line.
  quotes: (symbols) =>
    get(`/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}`),

  historical: (symbol, range = "3mo", interval = "1d") =>
    get(`/historical/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`),

  financials: (symbol) =>
    get(`/financials/${encodeURIComponent(symbol)}`),

  news: (symbols) =>
    get(`/news${symbols ? `?symbols=${encodeURIComponent(symbols.join(","))}` : ""}`),

  econCalendar: () => get("/econ-calendar"),

  treasuryRates: () => get("/treasury-rates"),

  search: (query) =>
    get(`/search?q=${encodeURIComponent(query)}`),

  cryptoMarkets: () => get("/crypto/markets"),

  cryptoChart: (id, range = "3mo") =>
    get(`/crypto/${encodeURIComponent(id)}/chart?range=${range}`),

  ipoCalendar: () => get("/ipo-calendar"),

  status: () => get("/status"),
};
