import { useEffect, useRef, useState } from "react";
import { Segmented } from "../ui/Segmented.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { normalizeSymbol } from "../lib/ticker.js";
import { DATE_RE, sharesHeldOn, newlyRejected } from "../lib/portfolio.js";
import { etParts, tradeDate } from "../lib/session.js";
import { fmtNum } from "../lib/format.js";
import { universeEntry } from "../data/universe.js";
import { api } from "../data/api.js";

const shareStr = (n) => fmtNum(n, n % 1 === 0 ? 0 : 4);

// Add one transaction. Validation is the same rule the accounting uses, so a
// sell that the position cannot cover is refused here rather than being
// silently dropped later. `transactions` is the whole list, because a sell
// can be covered on its own date and still take the shares a later sell
// needed; the check replays the list with the new row in it to catch that.
// `initialSymbol` seeds the symbol box (ADD TO PORTFOLIO from the quick look).
export function TransactionForm({ transactions, initialSymbol, onAdd }) {
  // Trade dates are New York dates, whatever the local calendar says. The
  // latest allowed is today in New York; the default is the last session.
  const latest = etParts(new Date()).ymd;
  const [date, setDate] = useState(() => tradeDate());
  const [symbol, setSymbol] = useState(() => initialSymbol || "");
  const [side, setSide] = useState("buy");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  // Set when the symbol was checked on ADD and nothing quotes it.
  const [symbolError, setSymbolError] = useState(null);
  const [checking, setChecking] = useState(false);
  const symRef = useRef(null);
  const sharesRef = useRef(null);

  // Opening the form puts the cursor where typing starts: the symbol, or the
  // shares when ADD TO PORTFOLIO already filled the symbol in. Not on a touch
  // screen, where focusing raises the keyboard over the page being looked at.
  useEffect(() => {
    const fine = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    const el = initialSymbol ? sharesRef.current : symRef.current;
    if (el) el.focus();
  }, [initialSymbol]);

  // A new seed replaces the symbol. What the user types afterwards stays,
  // because the seed itself does not change while they type.
  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
  }, [initialSymbol]);

  const list = Array.isArray(transactions) ? transactions : [];
  const sym = normalizeSymbol(symbol);
  const nShares = Number(shares);
  const nPrice = Number(price);
  const nFees = fees === "" ? 0 : Number(fees);
  const held = sym ? sharesHeldOn(list, sym, date) : 0;

  let error = null;
  if (symbol && !sym) error = "Symbol is not a ticker.";
  else if (!DATE_RE.test(date)) error = "Date must be YYYY-MM-DD.";
  else if (date > latest) error = "Date is after today in New York.";
  else if (shares && !(nShares > 0)) error = "Shares must be a positive number.";
  else if (price && !(nPrice > 0)) error = "Price must be a positive number.";
  else if (fees !== "" && !(nFees >= 0)) error = "Fees cannot be negative.";
  else if (side === "sell" && sym && nShares > 0) {
    if (nShares > held) {
      error = `You held ${shareStr(held)} ${sym} on ${date}.`;
    } else {
      // The price has no say in which rows the accounting applies, so a
      // placeholder lets this run before one is typed.
      const candidate = { date, symbol: sym, side, shares: nShares, price: 1, fees: 0 };
      const broken = newlyRejected(list, [...list, candidate]).find((t) => t !== candidate);
      if (broken) {
        error = `The ${broken.date} sell of ${shareStr(Number(broken.shares))} ${sym} would no longer be covered.`;
      }
    }
  }

  const ready = Boolean(sym) && nShares > 0 && nPrice > 0 && nFees >= 0 && !error && !checking;
  // What ADD is waiting for, so a disabled button is never a mystery.
  const missing = [!sym && "SYMBOL", !(nShares > 0) && "SHARES", !(nPrice > 0) && "PRICE"].filter(Boolean);
  const waiting = !error && missing.length
    ? `ENTER ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} AND ${missing[missing.length - 1]}` : missing[0]}`
    : null;

  // A symbol nothing quotes would sit in the holdings as NO QUOTE with no
  // history, so it is checked before it goes in: the tracked universe and
  // anything already traded pass at once; anything else must be an exact
  // match in the symbol search.
  const known = async (s) => {
    if (universeEntry(s) || list.some((t) => String(t.symbol || "").toUpperCase() === s)) return true;
    const rows = await api.search(s);
    return Array.isArray(rows) && rows.some((r) => String(r.symbol || "").toUpperCase() === s);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setChecking(true);
    let ok = false;
    try {
      ok = await known(sym);
      if (!ok) setSymbolError("UNKNOWN SYMBOL");
    } catch {
      setSymbolError("COULD NOT CHECK THE SYMBOL, TRY AGAIN");
    }
    setChecking(false);
    if (!ok) return;
    onAdd({ date, symbol: sym, side, shares: nShares, price: nPrice, fees: nFees });
    setSymbol("");
    setSide("buy");
    setShares("");
    setPrice("");
    setFees("");
  };

  return (
    <form className="pb-txform" onSubmit={submit}>
      <div className="pb-txform__row">
        <Input mono type="date" max={latest} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Trade date" className="pb-txform__date" />
        <Input
          mono
          value={symbol}
          onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setSymbolError(null); }}
          ref={symRef}
          aria-invalid={symbolError ? true : undefined}
          placeholder="SYMBOL"
          aria-label="Symbol"
          maxLength={12}
          className="pb-txform__sym"
        />
        <Segmented
          size="sm"
          label="Side"
          value={side}
          onChange={setSide}
          options={[{ value: "buy", label: "BUY" }, { value: "sell", label: "SELL" }]}
        />
        <Input mono type="number" step="any" min="0" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="SHARES" aria-label="Shares" ref={sharesRef} className="pb-txform__n" />
        <Input mono type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="PRICE" aria-label="Price per share" className="pb-txform__n" />
        <Input mono type="number" step="any" min="0" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="FEES" aria-label="Fees" className="pb-txform__n" />
        <Button type="submit" variant="primary" disabled={!ready} loading={checking}>ADD</Button>
      </div>
      {symbolError && <div className="pb-txform__note pb-warn" role="alert">{symbolError}: {sym}</div>}
      {!symbolError && error && <div className="pb-txform__note pb-warn">{error}</div>}
      {!symbolError && waiting && <div className="pb-txform__note pb-muted">{waiting}</div>}
      {!error && side === "sell" && sym && held > 0 && (
        <div className="pb-txform__note pb-muted">
          {shareStr(held)} {sym} held on {date}.
        </div>
      )}
    </form>
  );
}
