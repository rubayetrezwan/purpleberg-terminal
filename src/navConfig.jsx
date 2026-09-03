// Navigation metadata shared by the shell components (Sidebar, MobileMenu,
// CommandPalette, BottomBar) and App's router. Icons are lucide components.
import {
  Globe, TrendingUp, DollarSign, Landmark, Filter, Briefcase, Shield,
  Calendar, FileText, Gem, Bitcoin, GitCompare, Rocket,
} from "lucide-react";

export const SCREENS = [
  { id: "DASHBOARD", label: "Dashboard", icon: Globe, mnemonic: "WEI", desc: "Market Overview" },
  { id: "EQUITY", label: "Equities", icon: TrendingUp, mnemonic: "DES", desc: "Equity Analysis" },
  { id: "FX", label: "FX", icon: DollarSign, mnemonic: "WFX", desc: "Foreign Exchange" },
  { id: "FIXED_INCOME", label: "Fixed Income", icon: Landmark, mnemonic: "YAS", desc: "Bonds & Rates" },
  { id: "COMMODITIES", label: "Commodities", icon: Gem, mnemonic: "CMDT", desc: "Energy, Metals & Grains" },
  { id: "CRYPTO", label: "Crypto", icon: Bitcoin, mnemonic: "CRYP", desc: "Top 20 Cryptocurrencies" },
  { id: "IPO", label: "IPOs", icon: Rocket, mnemonic: "IPO", desc: "IPO Center — Top 2026 & live calendar" },
  { id: "SCREENER", label: "Screener", icon: Filter, mnemonic: "EQS", desc: "Stock Screener" },
  { id: "PORTFOLIO", label: "Portfolio", icon: Briefcase, mnemonic: "PORT", desc: "Portfolio Manager" },
  { id: "COMPARE", label: "Compare", icon: GitCompare, mnemonic: "COMP", desc: "Compare two stocks" },
  { id: "RISK", label: "Risk", icon: Shield, mnemonic: "MARS", desc: "Risk Analytics" },
  { id: "ECONOMICS", label: "Economics", icon: Calendar, mnemonic: "ECO", desc: "Economic Calendar" },
  { id: "NEWS", label: "News", icon: FileText, mnemonic: "TOP", desc: "News Center" },
];

// Bottom tab screens for mobile quick access.
export const MOBILE_TABS = [
  { id: "DASHBOARD", label: "Market", icon: Globe },
  { id: "EQUITY", label: "Equities", icon: TrendingUp },
  { id: "FX", label: "FX", icon: DollarSign },
  { id: "NEWS", label: "News", icon: FileText },
];
