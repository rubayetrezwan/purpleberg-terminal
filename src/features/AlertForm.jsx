import { useState } from "react";
import { Segmented } from "../ui/Segmented.jsx";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { toast } from "../ui/toasts.js";
import { addAlert } from "../stores/alerts.js";
import { conditionHolds } from "../lib/alerts.js";
import { fmtNum } from "../lib/format.js";

// Prices under a dollar trade in fractions of a cent, so rounding to cents
// would seed a 0.0345 stock as a 0.03 target and print it back that way.
// Below a dollar the seed keeps four significant digits and the confirmation
// shows the target as entered.
const seedPrice = (p) => (p >= 1 ? p.toFixed(2) : String(Number(p.toPrecision(4))));

// The opening target sits about 5% away on the side the alert watches: a
// target at the last price is not one anybody sets. It is rounded to a step a
// person would type: $5 from $1,000, $1 from $100, 5 cents from $1, and four
// significant digits below that.
function seedTarget(price, op) {
  if (!(price > 0)) return "";
  const raw = price * (op === "below" ? 0.95 : 1.05);
  if (price < 1) return String(Number(raw.toPrecision(4)));
  const step = price >= 1000 ? 5 : price >= 100 ? 1 : 0.05;
  const v = Math.round(raw / step) * step;
  return step < 1 ? v.toFixed(2) : String(v);
}
const fmtTarget = (p) => (p >= 1 ? fmtNum(p) : String(p));

// Inline alert form, used by the quick-look drawer and the Equities header.
export function AlertForm({ symbol, currentPrice, onDone }) {
  const [op, setOp] = useState("above");
  const [price, setPrice] = useState(() => seedTarget(currentPrice, "above"));
  // Until the user types a target, switching direction moves the seed to the
  // other side of the price.
  const [typed, setTyped] = useState(false);
  const changeOp = (next) => {
    setOp(next);
    if (!typed) setPrice(seedTarget(currentPrice, next));
  };
  const target = parseFloat(price);
  const valid = Number.isFinite(target) && target > 0;
  // A target typed as the price itself, rounded, is "at" and gets no note:
  // comparing it with the unrounded price called 37.91 "already above" a
  // 37.9134 stock.
  const atPrice = currentPrice > 0 && target === Number(seedPrice(currentPrice));
  const alreadyHolds = valid && currentPrice > 0 && !atPrice && conditionHolds(op, currentPrice, target);

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    addAlert({ symbol, op, price: target, baseline: currentPrice > 0 ? currentPrice : null });
    toast({ title: `ALERT ARMED · ${symbol} ${op.toUpperCase()} ${fmtTarget(target)}` });
    if (onDone) onDone();
  };

  return (
    <form className="pb-alertform" onSubmit={submit}>
      <div className="pb-alertform__row">
        <Segmented label="Direction" value={op} onChange={changeOp} options={[{ value: "above", label: "ABOVE" }, { value: "below", label: "BELOW" }]} />
        <Input mono type="number" step="any" min="0" value={price} onChange={(e) => { setPrice(e.target.value); setTyped(true); }} aria-label="Alert price" placeholder="PRICE" />
        <Button type="submit" variant="primary" disabled={!valid}>SAVE</Button>
      </div>
      {alreadyHolds && (
        <div className="pb-alertform__note pb-warn">
          ALREADY {op.toUpperCase()} {fmtTarget(target)} · FIRES ON THE NEXT CROSS
        </div>
      )}
    </form>
  );
}
