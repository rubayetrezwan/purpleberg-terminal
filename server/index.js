import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch {}

const app = express();
app.use(cors());
app.use(express.json());

// ── Simple in-memory cache ──────────────────────────────
const cache = new Map();

function cached(key, ttlMs, fn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  }).catch((e) => {
    if (entry) return entry.data;
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

// ── Beta cache (from quoteSummary, long TTL) ────────────
const betaCache = new Map();

async function fetchBeta(symbol) {
  const entry = betaCache.get(symbol);
  if (entry) return entry;
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics`;
    const data = await yahooAuthFetch(url);
    const ks = data.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};
    const beta = raw(ks.beta) || 0;
    betaCache.set(symbol, beta);
    return beta;
  } catch {
    return 0;
  }
}

// ── v7 batch quotes (with crumb auth) ───────────────────
async function yahooQuoteBatch(symbols) {
  // v7 supports up to ~50 symbols per request
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.map(encodeURIComponent).join(",")}`;
  const data = await yahooAuthFetch(url);
  const results = data.quoteResponse?.result || [];

  // Enrich equities with beta (fetched in parallel, cached permanently)
  const equities = results.filter((q) => q.quoteType === "EQUITY");
  if (equities.length > 0) {
    const betas = await Promise.all(equities.map((q) => fetchBeta(q.symbol)));
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
app.get("/api/quotes", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").split(",").filter(Boolean);
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
app.get("/api/historical/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const range = req.query.range || "3mo";
    const interval = req.query.interval || "1d";

    const cacheKey = `hist:${symbol}:${range}:${interval}`;
    const data = await cached(cacheKey, 300_000, () =>
      yahooHistorical(symbol, range, interval)
    );
    res.json(data);
  } catch (e) {
    console.error("Historical error:", e.message);
    res.json([]);
  }
});

// ── GET /api/financials/:symbol ─────────────────────────
app.get("/api/financials/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const cacheKey = `fin:${symbol}`;

    const data = await cached(cacheKey, 3600_000, () => yahooSummary(symbol));

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

    res.json({
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
    });
  } catch (e) {
    console.error("Financials error:", e.message);
    res.json({});
  }
});

// ── GET /api/news ───────────────────────────────────────
app.get("/api/news", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "AAPL,MSFT,GOOGL,TSLA,NVDA,JPM").split(",");
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

// ── GET /api/search ─────────────────────────────────────
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    if (!query) return res.json([]);

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

// ── POST /api/chat ──────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: "ANTHROPIC_API_KEY not configured",
      message: "To enable the AI assistant, add your Anthropic API key to the .env file.",
    });
  }

  try {
    const { messages } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system:
          "You are ASKB, the AI research assistant inside Purpleberg Terminal (a Bloomberg Terminal alternative). You are an expert financial analyst. Provide concise, data-driven responses about markets, securities, economics, and financial analysis. Use specific numbers and metrics when possible. Keep responses focused and professional.",
        messages,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.content?.map((c) => c.text || "").join("\n") || "Unable to process request.";
    res.json({ text });
  } catch (e) {
    console.error("Chat error:", e.message);
    res.status(500).json({ error: "AI service temporarily unavailable." });
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
refreshCrumb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ⚡ Purpleberg Terminal API running on http://localhost:${PORT}`);
    console.log(`  📊 Data source: Yahoo Finance (v7 API with crumb auth)`);
    console.log(`  🤖 AI Assistant: ${process.env.ANTHROPIC_API_KEY ? "Enabled" : "Not configured (set ANTHROPIC_API_KEY in .env)"}\n`);
  });
});
