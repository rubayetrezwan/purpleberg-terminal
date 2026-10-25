// Regenerates src/data/universeData.js, the stock universe that the shared
// quote poll and every list screen (Equities, Screener, Dashboard, the tape)
// draw from:
//
//   1. every S&P 500 member, from Wikipedia's constituents table
//   2. every Nasdaq-100 member, from nasdaq.com's own list
//   3. every other NYSE or Nasdaq listed stock worth at least $20B, from
//      Yahoo's screener (this is what brings in TSM, ASML, ARM and the like)
//
// Each symbol is checked against a live Yahoo quote, given Yahoo's sector, and
// the list is ordered by market cap. Index membership changes a few times a
// quarter: rerun this and commit the diff.
//
//   npm run universe
//
// Needs network access and takes about a minute.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../src/data/universeData.js", import.meta.url));
const CAP_FLOOR = 20e9;
// Yahoo exchange codes for NYSE, Nasdaq (three tiers), NYSE American, NYSE
// Arca and Cboe BZX. OTC listings (PNK and friends) are left out on purpose.
const US_EXCHANGES = new Set(["NYQ", "NMS", "NGM", "NCM", "ASE", "PCX", "BTS"]);
const YAHOO_SECTORS = [
  "Basic Materials", "Communication Services", "Consumer Cyclical", "Consumer Defensive",
  "Energy", "Financial Services", "Healthcare", "Industrials", "Real Estate",
  "Technology", "Utilities",
];

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const WIKI_UA = "PurplebergTerminal/3.0 (https://github.com/rubayetrezwan/purpleberg-terminal)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const yahooSymbol = (s) => s.trim().toUpperCase().replace(/\./g, "-");

async function fetchOk(url, options = {}, tries = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (i >= tries || ![429, 500, 502, 503].includes(res.status)) {
      throw new Error(`${res.status} ${res.statusText} for ${url.slice(0, 90)}`);
    }
    await sleep(1500 * i);
  }
}

// ── Sources ─────────────────────────────────────────────

async function sp500() {
  const res = await fetchOk(
    "https://en.wikipedia.org/w/index.php?title=List_of_S%26P_500_companies&action=raw",
    { headers: { "User-Agent": WIKI_UA } }
  );
  const text = await res.text();
  const table = text.split(/\n\{\|/).find((t) => t.includes('id="constituents"'));
  if (!table) throw new Error("S&P 500: constituents table not found on Wikipedia");
  const rows = table.split(/\n\|\}/)[0].split(/\n\|-/).slice(1);
  const out = [];
  for (const row of rows) {
    // The first cell is a ticker template: {{NyseSymbol|MMM}}, {{NasdaqSymbol|AAPL}}.
    const m = row.match(/\{\{\s*[A-Za-z ]+\|\s*([A-Za-z0-9.\-]+)\s*\}\}/);
    if (m) out.push(yahooSymbol(m[1]));
  }
  if (out.length < 495 || out.length > 510) throw new Error(`S&P 500: parsed ${out.length} rows, expected about 503`);
  return out;
}

async function nasdaq100() {
  const res = await fetchOk("https://api.nasdaq.com/api/quote/list-type/nasdaq100", {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  const rows = (await res.json())?.data?.data?.rows || [];
  const out = rows.map((r) => yahooSymbol(r.symbol)).filter(Boolean);
  if (out.length < 95 || out.length > 110) throw new Error(`Nasdaq-100: got ${out.length} rows, expected about 101`);
  return out;
}

async function yahooSession() {
  const c = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": BROWSER_UA }, redirect: "manual" });
  const cookie = (c.headers.getSetCookie?.() || []).find((x) => x.startsWith("A3="))?.split(";")[0];
  const crumbRes = await fetchOk("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": BROWSER_UA, Cookie: cookie },
  });
  const crumb = await crumbRes.text();
  const headers = { "User-Agent": BROWSER_UA, Accept: "application/json", Cookie: cookie };
  const withCrumb = (url) => `${url}${url.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(crumb)}`;
  return {
    async get(url) {
      return (await fetchOk(withCrumb(url), { headers })).json();
    },
    async post(url, body) {
      const res = await fetchOk(withCrumb(url), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
  };
}

// Every US-region equity matching `operands`, largest first.
async function screen(yahoo, operands) {
  const out = [];
  for (let offset = 0; offset < 5000; offset += 250) {
    const data = await yahoo.post("https://query2.finance.yahoo.com/v1/finance/screener?lang=en-US&region=US", {
      size: 250, offset, sortField: "intradaymarketcap", sortType: "DESC", quoteType: "EQUITY",
      query: { operator: "AND", operands: [{ operator: "eq", operands: ["region", "us"] }, ...operands] },
      userId: "", userIdType: "guid",
    });
    const quotes = data?.finance?.result?.[0]?.quotes || [];
    out.push(...quotes);
    if (quotes.length < 250) break;
    await sleep(300);
  }
  return out;
}

async function quotes(yahoo, symbols) {
  const out = new Map();
  for (let i = 0; i < symbols.length; i += 200) {
    const batch = symbols.slice(i, i + 200);
    const data = await yahoo.get(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${batch.map(encodeURIComponent).join(",")}`);
    for (const q of data?.quoteResponse?.result || []) out.set(q.symbol, q);
    await sleep(300);
  }
  return out;
}

async function sectorFromProfile(yahoo, symbol) {
  try {
    const data = await yahoo.get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile`);
    return data?.quoteSummary?.result?.[0]?.assetProfile?.sector || "";
  } catch {
    return "";
  }
}

// ── Build ───────────────────────────────────────────────

const normName = (q) => String(q.longName || q.shortName || q.symbol).toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  console.log("Fetching index members...");
  const [spx, ndx] = await Promise.all([sp500(), nasdaq100()]);
  const spxSet = new Set(spx);
  const ndxSet = new Set(ndx);
  console.log(`  S&P 500: ${spx.length}   Nasdaq-100: ${ndx.length}`);

  const yahoo = await yahooSession();
  console.log(`Screening NYSE/Nasdaq stocks worth $${CAP_FLOOR / 1e9}B or more...`);
  const big = (await screen(yahoo, [{ operator: "gt", operands: ["intradaymarketcap", CAP_FLOOR] }]))
    .filter((q) => US_EXCHANGES.has(q.exchange) && q.marketCap >= CAP_FLOOR);
  console.log(`  ${big.length} listed above the floor`);

  const candidates = [...new Set([...spx, ...ndx, ...big.map((q) => q.symbol)])];
  console.log(`Checking ${candidates.length} candidates against live quotes...`);
  const live = await quotes(yahoo, candidates);

  const rejected = [];
  const kept = [];
  for (const s of candidates) {
    const q = live.get(s);
    if (!q || q.quoteType !== "EQUITY" || !(q.regularMarketPrice > 0)) { rejected.push(s); continue; }
    kept.push(q);
  }

  // A company outside both indexes can list several share classes above the
  // floor (BRK-A next to BRK-B, FWONA next to FWONK). Keep one per company:
  // an index member if there is one, otherwise the most traded class.
  const byCompany = new Map();
  for (const q of kept) {
    const key = normName(q);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(q);
  }
  const dupes = [];
  const universe = [];
  for (const group of byCompany.values()) {
    const members = group.filter((q) => spxSet.has(q.symbol) || ndxSet.has(q.symbol));
    if (members.length) {
      universe.push(...members);
      dupes.push(...group.filter((q) => !members.includes(q)).map((q) => q.symbol));
    } else {
      group.sort((a, b) => (b.averageDailyVolume3Month || 0) - (a.averageDailyVolume3Month || 0));
      universe.push(group[0]);
      dupes.push(...group.slice(1).map((q) => q.symbol));
    }
  }

  console.log("Looking up sectors...");
  const sector = new Map();
  for (const name of YAHOO_SECTORS) {
    const rows = await screen(yahoo, [
      { operator: "eq", operands: ["sector", name] },
      { operator: "gt", operands: ["intradaymarketcap", 1e9] },
    ]);
    for (const q of rows) sector.set(q.symbol, name);
  }
  const unsorted = universe.filter((q) => !sector.has(q.symbol));
  for (const q of unsorted) {
    sector.set(q.symbol, await sectorFromProfile(yahoo, q.symbol));
    await sleep(250);
  }

  universe.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  const missingIndex = [...spx, ...ndx].filter((s) => !universe.some((q) => q.symbol === s));
  const noSector = universe.filter((q) => !sector.get(q.symbol)).map((q) => q.symbol);

  const asOf = new Date().toISOString().slice(0, 10);
  const rows = universe.map((q) => {
    const tags = [spxSet.has(q.symbol) && "SPX", ndxSet.has(q.symbol) && "NDX"].filter(Boolean).join(" ");
    const name = String(q.longName || q.shortName || q.symbol).replace(/\s+/g, " ").trim();
    return `  [${JSON.stringify(q.symbol)}, ${JSON.stringify(name)}, ${JSON.stringify(sector.get(q.symbol) || "")}, ${JSON.stringify(tags)}],`;
  });
  const counts = {
    spx: universe.filter((q) => spxSet.has(q.symbol)).length,
    ndx: universe.filter((q) => ndxSet.has(q.symbol)).length,
    other: universe.filter((q) => !spxSet.has(q.symbol) && !ndxSet.has(q.symbol)).length,
  };

  const file = `// GENERATED by scripts/build-universe.mjs on ${asOf}. Do not edit by hand:
// run \`npm run universe\` to refresh it, then commit the diff.
//
// Every S&P 500 and Nasdaq-100 member plus every other NYSE or Nasdaq listed
// stock worth at least $${CAP_FLOOR / 1e9}B on that day, each checked against a live Yahoo
// quote. ${universe.length} rows: ${counts.spx} in the S&P 500, ${counts.ndx} in the Nasdaq-100, ${counts.other} in neither.
// Ordered by market cap, largest first.
//
// Columns: symbol (Yahoo form, BRK-B not BRK.B), company name, Yahoo sector,
// index membership ("SPX", "NDX", "SPX NDX" or "").
export const UNIVERSE_AS_OF = ${JSON.stringify(asOf)};

export const UNIVERSE_ROWS = [
${rows.join("\n")}
];
`;
  await writeFile(OUT, file);

  console.log(`\nWrote ${universe.length} rows to ${OUT}`);
  console.log(`  S&P 500 ${counts.spx}, Nasdaq-100 ${counts.ndx}, other ${counts.other}`);
  if (missingIndex.length) console.log(`  Index members with no live quote (left out): ${missingIndex.join(", ")}`);
  if (rejected.length) console.log(`  Rejected (no live equity quote): ${rejected.join(", ")}`);
  if (dupes.length) console.log(`  Extra share classes left out: ${dupes.join(", ")}`);
  if (noSector.length) console.log(`  No sector found: ${noSector.join(", ")}`);
}

main().catch((e) => {
  console.error(`Universe build failed: ${e.message}`);
  process.exit(1);
});
