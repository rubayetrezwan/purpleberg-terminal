// Position of a value inside a low-to-high band, as a marker on a flat track.
// Used for the 52-week range and the crypto all-time band. `pct` is 0 to 100;
// null renders the track with no marker. An empty `label` prints the bare
// percentage, for a cell whose own heading already names the band.
export function RangeBar({ pct, lo, hi, label = "52W", className = "" }) {
  const clamped = pct == null ? null : Math.min(100, Math.max(0, pct));
  return (
    <div className={`pb-range${className ? " " + className : ""}`}>
      <div className="pb-range__track">
        {clamped != null && <span className="pb-range__mark" style={{ left: `${clamped}%` }} />}
      </div>
      <div className="pb-range__labels pb-label">
        <span>{lo}</span>
        <span>{clamped == null ? "—" : label ? `${clamped.toFixed(0)}% OF ${label}` : `${clamped.toFixed(0)}%`}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
