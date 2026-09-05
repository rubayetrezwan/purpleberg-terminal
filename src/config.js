// Ticker lists and reference data only. Colours live in src/theme/index.css as
// tokens, and formatters in src/lib/format.js — do not re-add either here.

// ═══════════════════════════════════════════
// STOCK TICKERS
// ═══════════════════════════════════════════

// Top 250 US equities by market cap, spanning every sector. Every ticker was
// verified to return a live quote from the proxy (Yahoo) before inclusion — dead
// or delisted symbols (e.g. SQ→XYZ, JNPR/DFS/IPG via 2025 M&A) were dropped so
// no row renders a permanent "—". Ordered by market cap descending.
export const US_STOCKS = [
  "NVDA", "GOOGL", "GOOG", "AAPL", "MSFT", "AMZN", "AVGO", "META", "TSLA", "MU",
  "BRK-B", "LLY", "WMT", "JPM", "AMD", "V", "INTC", "XOM", "JNJ", "ORCL",
  "CSCO", "LRCX", "AMAT", "MA", "COST", "CAT", "BAC", "ABBV", "UNH", "GE",
  "CVX", "PG", "MS", "KO", "HD", "NFLX", "GS", "PLTR", "KLAC", "MRK",
  "TXN", "DELL", "WFC", "IBM", "RTX", "C", "MRVL", "LIN", "WDC", "STX",
  "AXP", "PANW", "QCOM", "ANET", "MCD", "ADI", "PEP", "TMUS", "APH", "VZ",
  "AMGN", "TJX", "NEE", "BA", "DIS", "TMO", "CRWD", "BLK", "SCHW", "T",
  "UNP", "ETN", "DE", "GILD", "ABT", "GLW", "WELL", "UBER", "PFE", "ISRG",
  "SHOP", "HON", "PLD", "BKNG", "COP", "CRM", "CVS", "DHR", "SPGI", "CB",
  "LOW", "COF", "LMT", "PGR", "SYK", "PH", "MO", "SBUX", "NEM", "VRTX",
  "BMY", "HWM", "EQIX", "PWR", "FTNT", "CDNS", "SO", "MAR", "NOW", "MDT",
  "ACN", "FCX", "GD", "DUK", "SPOT", "CMI", "CME", "PNC", "UPS", "MCK",
  "USB", "MNST", "ADP", "JCI", "HCA", "WM", "WMB", "CSX", "ELV", "AMT",
  "SNPS", "CMCSA", "RCL", "ABNB", "EMR", "SNOW", "ADBE", "DDOG", "NET", "MCO",
  "SPG", "FDX", "ICE", "MDLZ", "HLT", "SHW", "SLB", "NOC", "CI", "ECL",
  "INTU", "NXPI", "ITW", "ROST", "ORLY", "GM", "DASH", "MPWR", "MPC", "TDG",
  "CL", "VLO", "AON", "CTAS", "AEP", "EOG", "KMI", "NSC", "BSX", "PSX",
  "DLR", "URI", "NKE", "WBD", "TRV", "REGN", "RSG", "TER", "HPE", "PCAR",
  "APD", "GWW", "TFC", "BKR", "TGT", "D", "SRE", "KEYS", "AFL", "CARR",
  "NUE", "O", "ALL", "F", "MET", "PSA", "TRGP", "AJG", "COR", "DAL",
  "OKE", "OXY", "CAH", "AME", "FANG", "FAST", "ROK", "MCHP", "ETR", "CTVA",
  "AZO", "EW", "EA", "NDAQ", "DVN", "XEL", "EBAY", "FITB", "ODFL", "EXC",
  "STT", "WAB", "ON", "GRMN", "IDXX", "COIN", "HUM", "DHI", "MSCI", "GFS",
  "KDP", "YUM", "CCL", "TTWO", "ADSK", "AMP", "CMG", "VTR", "LYV", "PEG",
  "BDX", "ED", "AIG", "STLD", "KR", "VMC", "PYPL", "UAL", "CCI", "SYY",
];

export const INDEX_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500", short: "SPX" },
  { symbol: "^DJI", name: "Dow Jones", short: "DJI" },
  { symbol: "^IXIC", name: "NASDAQ", short: "IXIC" },
  { symbol: "^FTSE", name: "FTSE 100", short: "FTSE" },
  { symbol: "^GDAXI", name: "DAX 40", short: "DAX" },
  { symbol: "^N225", name: "Nikkei 225", short: "N225" },
  { symbol: "^HSI", name: "Hang Seng", short: "HSI" },
  { symbol: "^BSESN", name: "BSE Sensex", short: "SENSEX" },
  { symbol: "^SSEC", name: "Shanghai Comp.", short: "SHCOMP" },
  { symbol: "^KS11", name: "KOSPI", short: "KOSPI" },
];

export const FX_SYMBOLS = [
  { symbol: "EURUSD=X", pair: "EUR/USD" },
  { symbol: "GBPUSD=X", pair: "GBP/USD" },
  { symbol: "USDJPY=X", pair: "USD/JPY" },
  { symbol: "USDCHF=X", pair: "USD/CHF" },
  { symbol: "AUDUSD=X", pair: "AUD/USD" },
  { symbol: "USDCAD=X", pair: "USD/CAD" },
  { symbol: "USDINR=X", pair: "USD/INR" },
  { symbol: "EURGBP=X", pair: "EUR/GBP" },
  { symbol: "USDSGD=X", pair: "USD/SGD" },
  { symbol: "NZDUSD=X", pair: "NZD/USD" },
  { symbol: "USDBDT=X", pair: "USD/BDT" },
  { symbol: "AUDBDT=X", pair: "AUD/BDT" },
  { symbol: "GBPBDT=X", pair: "GBP/BDT" },
  { symbol: "EURBDT=X", pair: "EUR/BDT" },
];

export const COMMODITY_SYMBOLS = [
  { symbol: "CL=F", name: "Crude Oil (WTI)", unit: "$/bbl" },
  { symbol: "BZ=F", name: "Brent Crude", unit: "$/bbl" },
  { symbol: "GC=F", name: "Gold", unit: "$/oz" },
  { symbol: "SI=F", name: "Silver", unit: "$/oz" },
  { symbol: "NG=F", name: "Natural Gas", unit: "$/MMBtu" },
  { symbol: "HG=F", name: "Copper", unit: "$/lb" },
  { symbol: "ZW=F", name: "Wheat", unit: "¢/bu" },
  { symbol: "ZC=F", name: "Corn", unit: "¢/bu" },
];

export const BOND_SYMBOLS = [
  { symbol: "^IRX", name: "US 3M T-Bill", tenor: "3M" },
  { symbol: "^FVX", name: "US 5Y Treasury", tenor: "5Y" },
  { symbol: "^TNX", name: "US 10Y Treasury", tenor: "10Y" },
  { symbol: "^TYX", name: "US 30Y Treasury", tenor: "30Y" },
];

export const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Energy",
  "Consumer Cyclical", "Industrials", "Basic Materials", "Utilities",
  "Real Estate", "Communication Services", "Consumer Defensive",
];

// ═══════════════════════════════════════════
// TOP IPOs OF 2026 (curated)
// ═══════════════════════════════════════════
// Hand-curated from public reporting (CNBC, Yahoo Finance, Renaissance Capital,
// Forge, DealRoom, stockanalysis.com, company filings) as of June 2026 — NOT a
// licensed data feed. Eleven "Listed" names trade today and their `ticker` is
// fed into the existing Yahoo quotes pipeline, so price / change / market-cap on
// the IPO screen are LIVE. Fourteen "Expected" names have no public ticker yet,
// so they show their reported target valuation only (no live price). `valuation`
// is the reported figure in USD (used for not-yet-listed rows; listed rows show
// live mkt-cap from the quote instead). `raised` is IPO proceeds in USD, only
// where a credible figure exists — left null rather than guessing. Exchange for
// listed rows comes from the live quote, so it isn't duplicated here. Ranked by
// approximate size (live market cap for listed, reported valuation for expected).
export const IPO_2026 = [
  { rank: 1, company: "SpaceX", ticker: "SPCX", date: "Jun 12, 2026", raised: 75_000_000_000, valuation: null, status: "Listed", sector: "Space / Aerospace" },
  { rank: 2, company: "OpenAI", ticker: null, date: "Q4 2026 (exp.)", raised: null, valuation: 1_000_000_000_000, status: "Expected", sector: "Artificial Intelligence" },
  { rank: 3, company: "Anthropic", ticker: null, date: "~Oct 2026 (exp.)", raised: null, valuation: 300_000_000_000, status: "Expected", sector: "Artificial Intelligence" },
  { rank: 4, company: "Stripe", ticker: null, date: "TBD 2026 (exp.)", raised: null, valuation: 106_000_000_000, status: "Expected", sector: "Fintech" },
  { rank: 5, company: "Databricks", ticker: null, date: "H2 2026 (exp.)", raised: null, valuation: 100_000_000_000, status: "Expected", sector: "Data / AI" },
  { rank: 6, company: "Revolut", ticker: null, date: "2026 (exp.)", raised: null, valuation: 75_000_000_000, status: "Expected", sector: "Fintech" },
  { rank: 7, company: "Anduril Industries", ticker: null, date: "Q2–Q3 2026 (exp.)", raised: null, valuation: 60_000_000_000, status: "Expected", sector: "Defense Tech" },
  { rank: 8, company: "Cerebras Systems", ticker: "CBRS", date: "May 14, 2026", raised: 5_600_000_000, valuation: null, status: "Listed", sector: "AI Hardware" },
  { rank: 9, company: "Canva", ticker: null, date: "2026 (exp.)", raised: null, valuation: 42_000_000_000, status: "Expected", sector: "Design / SaaS" },
  { rank: 10, company: "INNIO Group", ticker: "INIO", date: "Jun 4, 2026", raised: null, valuation: null, status: "Listed", sector: "Industrial Energy" },
  { rank: 11, company: "Kraken (Payward)", ticker: null, date: "2026 (exp.)", raised: null, valuation: 20_000_000_000, status: "Expected", sector: "Crypto Exchange" },
  { rank: 12, company: "Forgent Power Solutions", ticker: "FPS", date: "2026", raised: null, valuation: null, status: "Listed", sector: "AI Infrastructure / Power" },
  { rank: 13, company: "Discord", ticker: null, date: "2026 (exp.)", raised: null, valuation: 15_000_000_000, status: "Expected", sector: "Social / Gaming" },
  { rank: 14, company: "Pershing Square", ticker: "PS", date: "Apr 29, 2026", raised: null, valuation: null, status: "Listed", sector: "Asset Management" },
  { rank: 15, company: "Crusoe Energy Systems", ticker: null, date: "2026 (exp.)", raised: null, valuation: 13_000_000_000, status: "Expected", sector: "AI Infrastructure / Energy" },
  { rank: 16, company: "Fervo Energy", ticker: "FRVO", date: "May 13, 2026", raised: 1_890_000_000, valuation: null, status: "Listed", sector: "Geothermal Energy" },
  { rank: 17, company: "Monzo", ticker: null, date: "2026 (exp.)", raised: null, valuation: 8_000_000_000, status: "Expected", sector: "Fintech (UK)" },
  { rank: 18, company: "Consensys", ticker: null, date: "2026 (exp.)", raised: null, valuation: 7_000_000_000, status: "Expected", sector: "Crypto Infrastructure" },
  { rank: 19, company: "X-Energy", ticker: "XE", date: "Apr 24, 2026", raised: null, valuation: null, status: "Listed", sector: "Nuclear (SMR)" },
  { rank: 20, company: "Plaid", ticker: null, date: "Q2 2026 (exp.)", raised: 6_100_000_000, valuation: 6_100_000_000, status: "Expected", sector: "Fintech Infrastructure" },
  { rank: 21, company: "Cohere", ticker: null, date: "Q4 2026 (exp.)", raised: null, valuation: 5_500_000_000, status: "Expected", sector: "Artificial Intelligence" },
  { rank: 22, company: "Blackstone Digital Infrastructure Trust", ticker: "BXDC", date: "2026", raised: 1_750_000_000, valuation: null, status: "Listed", sector: "AI Data Centers (REIT)" },
  { rank: 23, company: "Quantinuum", ticker: "QNT", date: "Jun 4, 2026", raised: null, valuation: null, status: "Listed", sector: "Quantum Computing" },
  { rank: 24, company: "BitGo Holdings", ticker: "BTGO", date: "2026", raised: 213_000_000, valuation: null, status: "Listed", sector: "Crypto Custody" },
  { rank: 25, company: "Eikon Therapeutics", ticker: "EIKN", date: "2026", raised: null, valuation: null, status: "Listed", sector: "Biopharma" },
];

// Tickers from IPO_2026 that are actually trading — fed into useQuotes so the
// curated table can show live price/change/market-cap for listed names.
export const IPO_2026_LISTED_TICKERS = IPO_2026
  .filter((i) => i.ticker)
  .map((i) => i.ticker);
