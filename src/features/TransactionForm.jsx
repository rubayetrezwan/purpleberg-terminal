import { useEffect, useState } from "react";
import { Segmented } from "../ui/Segmented.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { normalizeSymbol } from "../lib/ticker.js";
import { DATE_RE, sharesHeldOn, newlyRejected } from "../lib/portfolio.js";
import { etParts, tradeDate } from "../lib/session.js";
import { fmtNum } from "../lib/format.js";

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

  const ready = Boolean(sym) && nShares > 0 && nPrice > 0 && nFees >= 0 && !error;

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    onAdd({ date, symbol: sym, side, shares: nShares, price: nPrice, fees: nFees });
    setSymbol("");
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
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
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
        <Input mono type="number" step="any" min="0" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="SHARES" aria-label="Shares" className="pb-txform__n" />
        <Input mono type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="PRICE" aria-label="Price per share" className="pb-txform__n" />
        <Input mono type="number" step="any" min="0" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="FEES" aria-label="Fees" className="pb-txform__n" />
        <Button type="submit" variant="primary" disabled={!ready}>ADD</Button>
      </div>
      {error && <div className="pb-txform__note pb-warn">{error}</div>}
      {!error && side === "sell" && sym && held > 0 && (
        <div className="pb-txform__note pb-muted">
          {shareStr(held)} {sym} held on {date}.
        </div>
      )}
    </form>
  );
}
