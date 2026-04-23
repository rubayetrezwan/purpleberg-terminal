import { useState } from "react";
import { GitCompare, ArrowLeftRight, X } from "lucide-react";
import { useColors } from "../ThemeContext";
import { useIsMobile } from "../hooks";
import { Panel, PanelHeader, Badge } from "../shared";

// COMPARE screen — side-by-side view of two tickers.
// v1 design: two text inputs → "Compare" button applies them to `liveA`/`liveB`
// (separate from input state so polling doesn't fire on every keystroke).
// All data fetches are driven by `liveA` / `liveB`. Inputs start as "" so nothing
// fetches on mount — the user picks two tickers first.
export default function CompareStocks({ allStockQuotes = [], news = [] }) {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);

  // Pending input state (what's in the boxes)
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  // Applied state (what's actually being fetched/displayed)
  const [liveA, setLiveA] = useState("");
  const [liveB, setLiveB] = useState("");

  const apply = () => {
    setLiveA(inputA.trim().toUpperCase());
    setLiveB(inputB.trim().toUpperCase());
  };

  const swap = () => {
    setInputA(inputB);
    setInputB(inputA);
    setLiveA(liveB);
    setLiveB(liveA);
  };

  const clear = () => {
    setInputA("");
    setInputB("");
    setLiveA("");
    setLiveB("");
  };

  const canCompare = inputA.trim() && inputB.trim() && inputA.trim().toUpperCase() !== inputB.trim().toUpperCase();

  const inputStyle = {
    flex: 1, minWidth: 0,
    background: COLORS.bgInput, border: `1px solid ${COLORS.border}`,
    color: COLORS.text, borderRadius: 3,
    padding: "6px 8px", fontSize: 12, outline: "none",
    fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1,
    textTransform: "uppercase",
  };

  const btnStyle = (disabled) => ({
    background: disabled ? COLORS.bgInput : COLORS.purple,
    color: disabled ? COLORS.textMuted : COLORS.white,
    border: "none", borderRadius: 3,
    padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ padding: isMobile ? 8 : 12 }}>
      <Panel>
        <PanelHeader
          icon={<GitCompare size={14} color={COLORS.purple} />}
          title="COMPARE STOCKS"
          subtitle="Side-by-side comparison of two equities"
          right={liveA && liveB ? <Badge color={COLORS.green}>{liveA} vs {liveB}</Badge> : null}
        />
        <div
          style={{
            padding: "10px 12px",
            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>A</span>
          <input
            aria-label="First ticker"
            value={inputA} onChange={(e) => setInputA(e.target.value)}
            placeholder="AAPL"
            onKeyDown={(e) => { if (e.key === "Enter" && canCompare) apply(); }}
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>vs</span>
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>B</span>
          <input
            aria-label="Second ticker"
            value={inputB} onChange={(e) => setInputB(e.target.value)}
            placeholder="MSFT"
            onKeyDown={(e) => { if (e.key === "Enter" && canCompare) apply(); }}
            style={inputStyle}
          />
          <button onClick={apply} disabled={!canCompare} style={btnStyle(!canCompare)}>
            Compare
          </button>
          <button onClick={swap} aria-label="Swap A and B" title="Swap A/B"
            style={{ ...btnStyle(false), background: COLORS.bgInput, color: COLORS.text, padding: "6px 8px" }}>
            <ArrowLeftRight size={12} />
          </button>
          <button onClick={clear} aria-label="Clear tickers" title="Clear"
            style={{ ...btnStyle(false), background: COLORS.bgInput, color: COLORS.text, padding: "6px 8px" }}>
            <X size={12} />
          </button>
        </div>

        {/* Empty state / future panels go here */}
        {(!liveA || !liveB) && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
            Enter two tickers above and press <strong>Compare</strong> to begin.
          </div>
        )}
        {liveA && liveB && (
          <div style={{ padding: 12, color: COLORS.textMuted, fontSize: 12 }}>
            {/* Task 4+ will populate these panels */}
            Comparing <strong style={{ color: COLORS.purpleLight }}>{liveA}</strong> vs{" "}
            <strong style={{ color: COLORS.purpleLight }}>{liveB}</strong> — panels coming online.
          </div>
        )}
      </Panel>
    </div>
  );
}
