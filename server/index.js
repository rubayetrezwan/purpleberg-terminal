import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { LRUCache } from "lru-cache";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch {}

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy

// CORS: allow same-origin in prod; open in dev for Vite proxy.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3001")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (no Origin header) and allow-listed origins pass.
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
}));
app.use(express.json({ limit: "32kb" }));

// ── Rate limiting ───────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,               // 120 reqs/min per IP for data endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded" },
});

// ── Input validation ────────────────────────────────────
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-^=]{0,14}$/i;
const RANGE_ALLOW = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]);
const INTERVAL_ALLOW = new Set(["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"]);
const isTicker = (s) => typeof s === "string" && TICKER_RE.test(s);

// ── Bounded LRU cache ───────────────────────────────────
const cache = new LRUCache({
  max: 2000,                // hard ceiling on keys
  ttl: 15 * 60_000,         // 15-min default TTL (per-entry TTL wins via ttlMs)
  allowStale: true,         // serve stale on upstream error
  updateAgeOnGet: false,
});

function cached(key, ttlMs, fn) {
  const entry = cache.get(key, { allowStale: false });
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then((data) => {
    cache.set(key, { data, ts: Date.now() }, { ttl: ttlMs });
    return data;
  }).catch((e) => {
    // On upstream error, serve any stale entry we still have.
    const stale = cache.get(key, { allowStale: true });
    if (stale) return stale.data;
    throw e;
  });
}

// ── Yahoo Finance API with crumb-based auth ─────────────
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let yahooCrumb = null;
let yahooCookie = null;
let crumbExpiry = 0;

async function refreshCrumb() {
  if (yahooCrumb && Date.now() < crumbExpiry) return;
  try {
    // Step 1: Get cookie from Yahoo
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    const setCookies = cookieRes.headers.getSetCookie?.() || [];
    const a3 = setCookies.find((c) => c.startsWith("A3="));
    if (a3) {
      yahooCookie = a3.split(";")[0];
    }

    // Step 2: Get crumb
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: yahooCookie },
    });
    if (crumbRes.ok) {
      yahooCrumb = await crumbRes.text();
      crumbExpiry = Date.now() + 3600_000; // 1hr
      console.log("  Yahoo crumb refreshed successfully");
    }
  } catch (e) {
    console.error("Crumb refresh error:", e.message);
  }
}

async function yahooFetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Yahoo API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function yahooAuthFetch(url) {
  await refreshCrumb();
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}crumb=${encodeURIComponent(yahooCrumb)}`;
  const res = await fetch(fullUrl, {
    headers: { "User-Agent": UA, "Accept": "application/json", Cookie: yahooCookie },
  });
  if (res.status === 401) {
    // Crumb expired, force refresh and retry
    crumbExpiry = 0;
    await refreshCrumb();
    const retryUrl = `${url}${sep}crumb=${encodeURIComponent(yahooCrumb)}`;
    const retry = await fetch(retryUrl, {
      headers: { "User-Agent": UA, "Accept": "application/json", Cookie: yahooCookie },
    });
    if (!retry.ok) throw new Error(`Yahoo API ${retry.status} (retry)`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`Yahoo API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Beta cache (from quoteSummary, 24h TTL) ─────────────
const betaCache = new LRUCache({ max: 500, ttl: 24 * 60 * 60_000 });

async function fetchBeta(symbol) {
  const hit = betaCache.get(symbol);
  if (hit !== undefined) return hit;
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics`;
    const data = await yahooAuthFetch(url);
    const ks = data.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};
    const beta = raw(ks.beta) || 0;
    betaCache.set(symbol, beta);
    return beta;
  } catch {
    // Cache the failure briefly so a flaky symbol doesn't DoS us.
    betaCache.set(symbol, 0, { ttl: 60_000 });
    return 0;
  }
}

// Simple concurrency limiter so cold-start doesn't fan out 96 parallel Yahoo requests.
async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── v7 batch quotes (with crumb auth) ───────────────────
async function yahooQuoteBatch(symbols) {
  // v7 supports up to ~50 symbols per request
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.map(encodeURIComponent).join(",")}`;
  const data = await yahooAuthFetch(url);
  const results = data.quoteResponse?.result || [];

  // Enrich equities with beta (throttled to 5 concurrent, 24h LRU cached).
  const equities = results.filter((q) => q.quoteType === "EQUITY");
  if (equities.length > 0) {
    const betas = await mapWithConcurrency(equities, 5, (q) => fetchBeta(q.symbol));
    equities.forEach((q, i) => { q.beta = betas[i]; });
  }

  return results;
}

// ── v8 chart fallback (no auth needed) ──────────────────
async function yahooChartQuote(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
  const data = await yahooFetch(url);
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) return null;
  return {
    symbol: meta.symbol,
    shortName: meta.shortName || meta.longName || meta.symbol,
    longName: meta.longName || meta.shortName || meta.symbol,
    regularMarketPrice: meta.regularMarketPrice ?? 0,
    regularMarketChange: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? meta.previousClose ?? 0),
    regularMarketChangePercent: meta.chartPreviousClose
      ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
      : 0,
    regularMarketDayHigh: meta.regularMarketDayHigh ?? 0,
    regularMarketDayLow: meta.regularMarketDayLow ?? 0,
    regularMarketPreviousClose: meta.chartPreviousClose ?? meta.previousClose ?? 0,
    regularMarketVolume: meta.regularMarketVolume ?? 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
    exchange: meta.exchangeName || meta.fullExchangeName || "",
    fullExchangeName: meta.fullExchangeName || "",
    currency: meta.currency || "USD",
    marketState: "REGULAR",
  };
}

async function yahooQuote(symbols) {
  // Try v7 batch first (has all financial data), fall back to v8 chart
  try {
    const results = await yahooQuoteBatch(symbols);
    if (results.length > 0) return results;
  } catch (e) {
    console.error("v7 batch failed, falling back to v8 chart:", e.message);
  }

  // Fallback: use v8 chart endpoint per symbol
  const results = [];
  const promises = symbols.map(async (sym) => {
    try {
      const q = await yahooChartQuote(sym);
      if (q) results.push(q);
    } catch (e) {
      console.error(`Chart fallback error for ${sym}:`, e.message);
    }
  });
  await Promise.all(promises);
  return results;
}

async function yahooHistorical(symbol, range = "3mo", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const data = await yahooFetch(url);
  const result = data.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};

  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().split("T")[0],
    open: quotes.open?.[i] ?? 0,
    high: quotes.high?.[i] ?? 0,
    low: quotes.low?.[i] ?? 0,
    close: quotes.close?.[i] ?? 0,
    volume: quotes.volume?.[i] ?? 0,
  })).filter((d) => d.close > 0);
}

async function yahooSearch(query) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=5`;
  return yahooFetch(url);
}

async function yahooSummary(symbol) {
  const modules = "summaryProfile,financialData,defaultKeyStatistics,earnings,recommendationTrend,earningsTrend";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  return yahooAuthFetch(url).then((d) => d.quoteSummary?.result?.[0] || {});
}

// ── Helper: extract raw value from Yahoo's {raw, fmt} ───
const raw = (v) => {
  if (v == null) return 0;
  if (typeof v === "object" && "raw" in v) return v.raw;
  return v;
};

// ── GET /api/quotes ─────────────────────────────────────
app.get("/api/quotes", apiLimiter, async (req, res) => {
  try {
    const raw = (req.query.symbols || "").split(",").filter(Boolean);
    const symbols = raw.filter(isTicker).slice(0, 80); // hard cap per request
    if (!symbols.length) return res.json([]);

    const cacheKey = `quotes:${symbols.sort().join(",")}`;
    const data = await cached(cacheKey, 12_000, async () => {
      const results = [];
      // Batch in groups of 40 (v7 supports larger batches)
      for (let i = 0; i < symbols.length; i += 40) {
        const batch = symbols.slice(i, i + 40);
        const batchResults = await yahooQuote(batch);
        results.push(...batchResults);
        if (i + 40 < symbols.length) await new Promise((r) => setTimeout(r, 200));
      }
      return results;
    });

    const mapped = data.map((q) => ({
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      open: q.regularMarketOpen ?? 0,
      high: q.regularMarketDayHigh ?? 0,
      low: q.regularMarketDayLow ?? 0,
      prevClose: q.regularMarketPreviousClose ?? 0,
      volume: q.regularMarketVolume ?? 0,
      marketCap: q.marketCap ?? 0,
      pe: q.trailingPE ?? 0,
      eps: q.epsTrailingTwelveMonths ?? 0,
      week52High: q.fiftyTwoWeekHigh ?? 0,
      week52Low: q.fiftyTwoWeekLow ?? 0,
      avgVolume: q.averageDailyVolume3Month ?? 0,
      dividendYield: q.trailingAnnualDividendYield ? q.trailingAnnualDividendYield * 100 : 0,
      beta: q.beta ?? 0,
      exchange: q.exchange || q.fullExchangeName || "",
      currency: q.currency || "USD",
      marketState: q.marketState || "CLOSED",
    }));
    res.json(mapped);
  } catch (e) {
    console.error("Quote error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/historical/:symbol ─────────────────────────
app.get("/api/historical/:symbol", apiLimiter, async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isTicker(symbol)) return res.status(400).json({ error: "invalid symbol" });
    const range = RANGE_ALLOW.has(req.query.range) ? req.query.range : "3mo";
    const interval = INTERVAL_ALLOW.has(req.query.interval) ? req.query.interval : "1d";

    const cacheKey = `hist:${symbol}:${range}:${interval}`;
    const data = await cached(cacheKey, 300_000, () =>
      yahooHistorical(symbol, range, interval)
    );
    res.json(data);
  } catch (e) {
    console.error("Historical error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/financials/:symbol ─────────────────────────
app.get("/api/financials/:symbol", apiLimiter, async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isTicker(symbol)) return res.status(400).json({ error: "invalid symbol" });
    const cacheKey = `fin:${symbol}`;

    // Try to get fresh data, with retry on auth failure
    let data;
    try {
      data = await cached(cacheKey, 1800_000, () => yahooSummary(symbol));
    } catch (e1) {
      console.error(`Financials first attempt failed for ${symbol}:`, e1.message);
      // Force crumb refresh and retry
      crumbExpiry = 0;
      try {
        data = await yahooSummary(symbol);
        cache.set(cacheKey, { data, ts: Date.now() }, { ttl: 1800_000 });
      } catch (e2) {
        console.error(`Financials retry failed for ${symbol}:`, e2.message);
        data = {};
      }
    }

    const fd = data.financialData || {};
    const ks = data.defaultKeyStatistics || {};
    const profile = data.summaryProfile || {};
    const earnings = data.earnings || {};
    const recTrend = data.recommendationTrend?.trend?.[0] || {};
    const earningsTrend = data.earningsTrend?.trend || [];

    const quarterlyRevenue = (earnings.financialsChart?.quarterly || []).map((q) => ({
      quarter: q.date,
      revenue: raw(q.revenue),
      earnings: raw(q.earnings),
    }));

    const totalRec = (recTrend.strongBuy || 0) + (recTrend.buy || 0) + (recTrend.hold || 0) + (recTrend.sell || 0) + (recTrend.strongSell || 0);
    const buyPct = totalRec ? Math.round(((recTrend.strongBuy || 0) + (recTrend.buy || 0)) / totalRec * 100) : 0;
    const holdPct = totalRec ? Math.round((recTrend.hold || 0) / totalRec * 100) : 0;
    const sellPct = totalRec ? Math.round(((recTrend.sell || 0) + (recTrend.strongSell || 0)) / totalRec * 100) : 0;

    const result = {
      profile: {
        sector: profile.sector || "N/A",
        industry: profile.industry || "N/A",
        country: profile.country || "N/A",
        employees: raw(profile.fullTimeEmployees),
        summary: profile.longBusinessSummary || "",
        website: profile.website || "",
      },
      margins: {
        gross: fd.grossMargins ? (raw(fd.grossMargins) * 100).toFixed(1) : "0",
        operating: fd.operatingMargins ? (raw(fd.operatingMargins) * 100).toFixed(1) : "0",
        profit: fd.profitMargins ? (raw(fd.profitMargins) * 100).toFixed(1) : "0",
        ebitda: fd.ebitdaMargins ? (raw(fd.ebitdaMargins) * 100).toFixed(1) : "0",
      },
      ratios: {
        pe: raw(ks.trailingPe || ks.forwardPe),
        pb: raw(ks.priceToBook),
        ps: raw(ks.priceToSalesTrailing12Months),
        evEbitda: raw(ks.enterpriseToEbitda),
        roe: fd.returnOnEquity ? (raw(fd.returnOnEquity) * 100).toFixed(1) : "0",
        roa: fd.returnOnAssets ? (raw(fd.returnOnAssets) * 100).toFixed(1) : "0",
        debtToEquity: raw(fd.debtToEquity),
        currentRatio: raw(fd.currentRatio),
      },
      estimates: {
        targetHigh: raw(fd.targetHighPrice),
        targetLow: raw(fd.targetLowPrice),
        targetMean: raw(fd.targetMeanPrice),
        targetMedian: raw(fd.targetMedianPrice),
        revenueEstimate: fd.revenueGrowth ? (raw(fd.revenueGrowth) * 100).toFixed(1) + "%" : "N/A",
        epsEstimate: raw(earningsTrend[0]?.earningsEstimate?.avg),
        epsPrev: raw(earningsTrend[0]?.earningsEstimate?.yearAgoEps),
      },
      recommendations: { buy: buyPct, hold: holdPct, sell: sellPct },
      quarterlyRevenue,
    };

    // Don't cache empty results (they indicate API failure)
    const hasData = profile.sector || quarterlyRevenue.length > 0 || raw(ks.trailingPe);
    if (!hasData) {
      cache.delete(cacheKey); // Remove bad cache entry
    }

    res.json(result);
  } catch (e) {
    console.error("Financials error:", e.message);
    // Return structure with empty data rather than empty object
    res.json({
      profile: { sector: "N/A", industry: "N/A", country: "N/A", employees: 0, summary: "", website: "" },
      margins: { gross: "0", operating: "0", profit: "0", ebitda: "0" },
      ratios: { pe: 0, pb: 0, ps: 0, evEbitda: 0, roe: "0", roa: "0", debtToEquity: 0, currentRatio: 0 },
      estimates: { targetHigh: 0, targetLow: 0, targetMean: 0, targetMedian: 0, revenueEstimate: "N/A", epsEstimate: 0, epsPrev: 0 },
      recommendations: { buy: 0, hold: 0, sell: 0 },
      quarterlyRevenue: [],
    });
  }
});

// ── GET /api/news ───────────────────────────────────────
app.get("/api/news", apiLimiter, async (req, res) => {
  try {
    const raw = (req.query.symbols || "AAPL,MSFT,GOOGL,TSLA,NVDA,JPM").split(",");
    const symbols = raw.filter(isTicker).slice(0, 10);
    if (!symbols.length) return res.json([]);
    const cacheKey = `news:${symbols.sort().join(",")}`;

    const data = await cached(cacheKey, 120_000, async () => {
      const results = [];
      for (const sym of symbols.slice(0, 4)) {
        try {
          const searchData = await yahooSearch(sym);
          if (searchData.news) {
            results.push(
              ...searchData.news.map((n) => ({
                title: n.title,
                link: n.link,
                publisher: n.publisher,
                publishedAt: n.providerPublishTime,
                relatedSymbol: sym,
                thumbnail: n.thumbnail?.resolutions?.[0]?.url || "",
              }))
            );
          }
        } catch (e) {
          console.error(`News fetch error for ${sym}:`, e.message);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      const seen = new Set();
      return results
        .filter((n) => { if (seen.has(n.title)) return false; seen.add(n.title); return true; })
        .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    });

    res.json(data);
  } catch (e) {
    console.error("News error:", e.message);
    res.json([]);
  }
});

// ── GET /api/econ-calendar ───────────────────────────────
// Fetch real economic calendar events from Forex Factory
app.get("/api/econ-calendar", apiLimiter, async (req, res) => {
  try {
    const cacheKey = "econ:calendar";
    const data = await cached(cacheKey, 600_000, async () => {
      const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "application/json" },
      });
      if (!r.ok) throw new Error(`Calendar fetch error: ${r.status}`);
      const events = await r.json();

      // Filter to Medium/High impact events from major economies
      const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD", "CNY"];
      return events
        .filter((ev) => majorCurrencies.includes(ev.country) && (ev.impact === "High" || ev.impact === "Medium"))
        .map((ev) => {
          const d = ev.date ? new Date(ev.date) : null;
          return {
            date: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }) : "—",
            time: d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }) + " ET" : "—",
            event: ev.title || "—",
            country: ev.country || "—",
            actual: ev.actual || "—",
            forecast: ev.forecast || "—",
            previous: ev.previous || "—",
            impact: ev.impact === "High" ? "high" : "med",
          };
        });
    });

    res.json(data);
  } catch (e) {
    console.error("Economic calendar error:", e.message);
    // Check if we have stale cached data to return
    const stale = cache.get("econ:calendar", { allowStale: true });
    if (stale) return res.json(stale.data);
    res.json([]);
  }
});

// ── GET /api/treasury-rates ─────────────────────────────
// Fetch real treasury/central bank rates from Yahoo Finance
app.get("/api/treasury-rates", apiLimiter, async (req, res) => {
  try {
    const cacheKey = "treasury:rates";
    const data = await cached(cacheKey, 300_000, async () => {
      // Use Yahoo Finance to get real treasury yields
      const symbols = ["^IRX", "^FVX", "^TNX", "^TYX"];
      const results = await yahooQuote(symbols);

      return {
        us3m: results.find((r) => r.symbol === "^IRX")?.regularMarketPrice ?? 0,
        us5y: results.find((r) => r.symbol === "^FVX")?.regularMarketPrice ?? 0,
        us10y: results.find((r) => r.symbol === "^TNX")?.regularMarketPrice ?? 0,
        us30y: results.find((r) => r.symbol === "^TYX")?.regularMarketPrice ?? 0,
      };
    });

    res.json(data);
  } catch (e) {
    console.error("Treasury rates error:", e.message);
    res.json({});
  }
});

// ── GET /api/search ─────────────────────────────────────
app.get("/api/search", apiLimiter, async (req, res) => {
  try {
    const query = String(req.query.q || "").slice(0, 40);
    if (!query || !/^[\w\s.\-^=&]+$/i.test(query)) return res.json([]);

    const cacheKey = `search:${query}`;
    const data = await cached(cacheKey, 60_000, async () => {
      const result = await yahooSearch(query);
      return (result.quotes || [])
        .filter((q) => ["EQUITY", "INDEX", "CURRENCY", "FUTURE", "ETF"].includes(q.quoteType))
        .slice(0, 10)
        .map((q) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: q.quoteType,
          exchange: q.exchange,
        }));
    });
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

// ── Serve static files (built frontend) ─────────────────
import fs from "fs";

const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
}

// ── Start server ────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// Pre-fetch crumb at startup
refreshCrumb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Purpleberg Terminal API running on http://localhost:${PORT}`);
      console.log(`  Data source: Yahoo Finance (v7 API with crumb auth)\n`);
    });
  })
  .catch((e) => {
    console.error("Failed to initialise Yahoo crumb:", e.message);
    // Start anyway — crumb will be retried on first request
    app.listen(PORT, () => {
      console.log(`\n  Purpleberg Terminal API running on http://localhost:${PORT} (crumb pending)\n`);
    });
  });
