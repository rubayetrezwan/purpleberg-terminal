import { Star } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { watchlist } from "../stores/watchlist.js";
import { useQuickLook } from "./quickLookContext.js";
import { toggleWatch } from "./watchActions.js";

// Every symbol on screen is a Ticker: click opens quick-look, the star toggles
// the watchlist. Both stop propagation so table rows keep their own click.
export function Ticker({ symbol, name, star = true, className = "" }) {
  const { open } = useQuickLook();
  const starred = useStore(watchlist, (s) => s.symbols.includes(symbol));
  return (
    <span className={`pb-ticker${className ? " " + className : ""}`}>
      <button
        type="button"
        className="pb-reset pb-ticker__sym"
        title={name ? `${name} · quick look` : "Quick look"}
        onClick={(e) => { e.stopPropagation(); open(symbol); }}
      >
        {symbol}
      </button>
      {star && (
        <button
          type="button"
          className={`pb-reset pb-ticker__star${starred ? " pb-ticker__star--on" : ""}`}
          aria-label={starred ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          aria-pressed={starred}
          onClick={(e) => { e.stopPropagation(); toggleWatch(symbol); }}
        >
          <Star size={11} strokeWidth={1.5} fill={starred ? "currentColor" : "none"} />
        </button>
      )}
    </span>
  );
}
