// Yahoo's exchange codes as the names a terminal user knows. Anything not
// listed passes through unchanged rather than guessing.
const EXCHANGES = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NasdaqGS: "NASDAQ", NasdaqGM: "NASDAQ", NasdaqCM: "NASDAQ",
  NYQ: "NYSE", NYSE: "NYSE",
  ASE: "NYSE AMER", PCX: "NYSE ARCA", BTS: "CBOE", BATS: "CBOE",
  PNK: "OTC", OQX: "OTC", OQB: "OTC", OID: "OTC",
  CCY: "FX", CCC: "CRYPTO", CME: "CME", CBT: "CBOT", NYM: "NYMEX", CMX: "COMEX",
  SNP: "S&P", DJI: "DJ", NIM: "NASDAQ", FGI: "FTSE", GER: "XETRA", OSA: "OSAKA", HKG: "HKEX", BSE: "BSE", SHH: "SSE", KSC: "KRX",
};

export function exchangeLabel(code) {
  if (!code) return "";
  return EXCHANGES[code] || String(code).toUpperCase();
}
