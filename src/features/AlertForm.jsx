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
const fmtTarget = (p) => (p >= 1 ? fmtNum(p) : String(p));

// Inline alert form, used by the quick-look drawer and the Equities header.
export function AlertForm({ symbol, currentPrice, onDone }) {
  const [op, setOp] = useState("above");
  const [price, setPrice] = useState(currentPrice > 0 ? seedPrice(currentPrice) : "");
  const target = parseFloat(price);
  const valid = Number.isFinite(target) && target > 0;
  const alreadyHolds = valid && currentPrice > 0 && conditionHolds(op, currentPrice, target);

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
        <Segmented label="Direction" value={op} onChange={setOp} options={[{ value: "above", label: "ABOVE" }, { value: "below", label: "BELOW" }]} />
        <Input mono type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Alert price" placeholder="PRICE" />
        <Button type="submit" variant="primary" disabled={!valid}>SAVE</Button>
      </div>
      {alreadyHolds && (
        <div className="pb-alertform__note pb-warn">
          Already {op} {fmtTarget(target)}. Fires the next time price crosses from the other side.
        </div>
      )}
    </form>
  );
}
