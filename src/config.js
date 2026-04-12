// Theme colours are the single source of truth in ./ThemeContext.jsx —
// do not re-add them here. Screens pull palette via `useColors()`.

// ═══════════════════════════════════════════
// STOCK TICKERS
// ═══════════════════════════════════════════

export const US_STOCKS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "JNJ", "WMT", "XOM", "BAC", "PFE", "NFLX",
  "DIS", "UNH", "HD", "MA", "PG", "KO", "PEP", "ABBV",
  "MRK", "COST", "AVGO", "CRM", "AMD", "CSCO", "ACN", "ORCL",
  "ADBE", "LLY", "TMO", "NKE", "MCD", "TXN", "QCOM", "CVX",
  "LIN", "NEE", "INTC", "GS", "MS", "C", "PYPL", "UBER",
  "AMGN", "IBM", "GE", "CAT", "BA", "RTX", "HON", "LOW",
  "SPGI", "DE", "BLK", "ISRG", "MDLZ", "ADP", "VRTX", "GILD",
  "SYK", "MMC", "REGN", "LRCX", "ADI", "PANW", "ETN", "CB",
  "SBUX", "MO", "KLAC", "CME", "SO", "DUK", "CI", "ZTS",
  "BSX", "ICE", "MCK", "SHW", "CL", "SNPS", "CDNS", "CMG",
  "FDX", "GM", "F", "ABNB", "RIVN", "COIN", "SQ", "SHOP",
  "SNOW", "PLTR", "NET", "DDOG", "ZS",
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

// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════

export const fmt = (n, d = 2) => {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(d);
};

export const fmtK = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n === 0) return "0";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
};

export const fmtPct = (n) => {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

export const ts = () =>
  new Date().toLocaleTimeString("en-US", { hour12: false });

export const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Energy",
  "Consumer Cyclical", "Industrials", "Basic Materials", "Utilities",
  "Real Estate", "Communication Services", "Consumer Defensive",
];
