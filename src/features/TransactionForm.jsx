import { useState } from "react";
import { Segmented } from "../ui/Segmented.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { normalizeSymbol } from "../lib/ticker.js";
import { localYmd, DATE_RE } from "../lib/portfolio.js";
import { fmtNum } from "../lib/format.js";

// Add one transaction. Validation is the same rule the accounting uses, so a
// sell that the position cannot cover is refused here rather than being
// silently dropped later: `sharesHeld(symbol)` is the position on that date.
export function TransactionForm({ sharesHeld, onAdd }) {
  const today = localYmd(new Date());
  const [date, setDate] = useState(today);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("buy");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");

  const sym = normalizeSymbol(symbol);
  const nShares = Number(shares);
  const nPrice = Number(price);
  const nFees = fees === "" ? 0 : Number(fees);
  const held = sym && sharesHeld ? sharesHeld(sym, date) : 0;

  let error = null;
  if (symbol && !sym) error = "Symbol is not a ticker.";
  else if (!DATE_RE.test(date)) error = "Date must be YYYY-MM-DD.";
  else if (date > today) error = "Date is in the future.";
  else if (shares && !(nShares > 0)) error = "Shares must be a positive number.";
  else if (price && !(nPrice > 0)) error = "Price must be a positive number.";
  else if (fees !== "" && !(nFees >= 0)) error = "Fees cannot be negative.";
  else if (side === "sell" && sym && nShares > 0 && nShares > held) {
    error = `You held ${fmtNum(held, held % 1 === 0 ? 0 : 4)} ${sym} on ${date}.`;
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
        <Input mono type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Trade date" className="pb-txform__date" />
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
          {fmtNum(held, held % 1 === 0 ? 0 : 4)} {sym} held on {date}.
        </div>
      )}
    </form>
  );
}
