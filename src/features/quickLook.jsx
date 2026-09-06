import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Star, X } from "lucide-react";
import { QuickLookContext } from "../ui/quickLookContext.js";
import { Drawer } from "../ui/Drawer.jsx";
import { Sparkline } from "../ui/Sparkline.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Change } from "../ui/Change.jsx";
import { Price } from "../ui/Price.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Button } from "../ui/Button.jsx";
import { Loading } from "../ui/Loading.jsx";
import { toggleWatch } from "../ui/watchActions.js";
import { useStore } from "../stores/useStore.js";
import { watchlist, normalizeSymbol } from "../stores/watchlist.js";
import { useQuote, usePoolExtra } from "../data/quotePool.jsx";
import { useHistorical } from "../data/hooks.js";
import { navigate, pathFor } from "../router/index.jsx";
import { fmt, fmtK, fmtNum, fmtSigned } from "../lib/format.js";
import { useNewsFeed } from "./newsFeed.jsx";
import { AlertForm } from "./AlertForm.jsx";

export function QuickLookProvider({ children }) {
  const [symbol, setSymbol] = useState(null);
  const open = useCallback((s) => { const n = normalizeSymbol(s); if (n) setSymbol(n); }, []);
  const close = useCallback(() => setSymbol(null), []);
  const value = useMemo(() => ({ symbol, open, close }), [symbol, open, close]);
  return (
    <QuickLookContext.Provider value={value}>
      {children}
      <QuickLookDrawer symbol={symbol} onClose={close} />
    </QuickLookContext.Provider>
  );
}

function QuickLookDrawer({ symbol, onClose }) {
  usePoolExtra(symbol);
  const q = useQuote(symbol);
  const { data: hist } = useHistorical(symbol, "1mo");
  const { news } = useNewsFeed();
  const [alertOpen, setAlertOpen] = useState(false);
  useEffect(() => { setAlertOpen(false); }, [symbol]);
  const starred = useStore(watchlist, (s) => (symbol ? s.symbols.includes(symbol) : false));
  const closes = useMemo(() => hist.map((d) => d.close), [hist]);
  const headlines = useMemo(
    () => (news || []).filter((n) => (n.relatedSymbol || "").toUpperCase() === symbol).slice(0, 3),
    [news, symbol]
  );

  const goEquities = () => { navigate(pathFor("equities", { symbol })); onClose(); };
  const goPortfolio = () => { navigate(pathFor("portfolio", {}, { tab: "transactions", symbol })); onClose(); };

  const range52 = q && q.week52High > q.week52Low && q.week52Low > 0
    ? Math.min(100, Math.max(0, ((q.price - q.week52Low) / (q.week52High - q.week52Low)) * 100))
    : null;

  const header = symbol ? (
    <header className="pb-drawer__head pb-ql__head">
      <span className="pb-ql__sym">{symbol}</span>
      <span className="pb-ql__name pb-muted">{q ? q.name : ""}</span>
      <span className="pb-ql__tools">
        <button type="button" className={`pb-reset pb-iconbtn${starred ? " pb-accent" : ""}`} aria-label={starred ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={starred} onClick={() => toggleWatch(symbol)}>
          <Star size={13} strokeWidth={1.5} fill={starred ? "currentColor" : "none"} />
        </button>
        <button type="button" className={`pb-reset pb-iconbtn${alertOpen ? " pb-accent" : ""}`} aria-label="Set price alert" aria-expanded={alertOpen} onClick={() => setAlertOpen((v) => !v)}>
          <Bell size={13} strokeWidth={1.5} />
        </button>
        <button type="button" className="pb-reset pb-iconbtn" aria-label="Close" onClick={onClose}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </span>
    </header>
  ) : null;

  return (
    <Drawer open={Boolean(symbol)} onClose={onClose} header={header} ariaLabel={`Quick look ${symbol || ""}`}>
      {symbol && (
        <div className="pb-ql">
          {!q ? <Loading /> : (
            <>
              <div className="pb-ql__price">
                <Price value={q.price} format={(v) => fmtNum(v, 2)} className="pb-ql__last" />
                <span className={q.change == null ? "" : q.change >= 0 ? "pb-up" : "pb-down"}>{fmtSigned(q.change)} <Change value={q.changePercent} /></span>
                <span className="pb-ql__tags">
                  <Tag>{q.exchange || "—"}</Tag>
                  {q.marketState && <Tag tone={q.marketState === "REGULAR" ? "up" : undefined}>{q.marketState === "REGULAR" ? "OPEN" : q.marketState}</Tag>}
                </span>
              </div>
              <div className="pb-ql__spark">
                {closes.length > 1 ? <Sparkline values={closes} width={330} height={56} /> : <span className="pb-label">1M CHART LOADING…</span>}
              </div>
              {alertOpen && <div className="pb-ql__alert"><AlertForm symbol={symbol} currentPrice={q.price} onDone={() => setAlertOpen(false)} /></div>}
              <KVList cols={2}>
                <KV k="OPEN" v={fmtNum(q.open)} />
                <KV k="PREV" v={fmtNum(q.prevClose)} />
                <KV k="HI" v={fmtNum(q.high)} />
                <KV k="LO" v={fmtNum(q.low)} />
                <KV k="VOL" v={fmtK(q.volume)} />
                <KV k="AVG VOL" v={fmtK(q.avgVolume)} />
                <KV k="MKT CAP" v={q.marketCap > 0 ? fmtK(q.marketCap) : "—"} />
                <KV k="P/E" v={q.pe > 0 ? fmt(q.pe, 1) + "x" : "—"} />
                <KV k="EPS" v={q.eps ? fmt(q.eps) : "—"} />
                <KV k="DIV YLD" v={q.dividendYield > 0 ? fmt(q.dividendYield) + "%" : "—"} />
                <KV k="BETA" v={q.beta ? fmt(q.beta) : "—"} />
                <KV k="52W" v={q.week52Low > 0 ? `${fmt(q.week52Low, 0)} – ${fmt(q.week52High, 0)}` : "—"} />
              </KVList>
              {range52 != null && (
                <div className="pb-ql__range" title="Position in the 52-week range">
                  <div className="pb-ql__rangebar"><span style={{ left: `${range52}%` }} /></div>
                  <div className="pb-ql__rangelbl pb-label"><span>52W LO</span><span>{range52.toFixed(0)}%</span><span>52W HI</span></div>
                </div>
              )}
            </>
          )}
          <div className="pb-ql__news">
            <div className="pb-label pb-ql__newshead">HEADLINES</div>
            {headlines.length === 0 ? (
              <div className="pb-muted pb-ql__nonews">No headlines for {symbol} in the current feed.</div>
            ) : headlines.map((n) => (
              <a key={n.link || n.title} className="pb-ql__headline" href={n.link} target="_blank" rel="noopener noreferrer">
                <div>{n.title}</div>
                <div className="pb-muted pb-label">
                  {n.publisher}
                  {n.publishedAt ? ` · ${new Date(n.publishedAt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}
                </div>
              </a>
            ))}
          </div>
          <div className="pb-ql__actions">
            <Button variant="primary" onClick={goEquities}>OPEN IN EQUITIES</Button>
            <Button onClick={goPortfolio}>ADD TO PORTFOLIO</Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
