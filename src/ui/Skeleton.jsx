// Plain placeholder lines for tables and charts while data loads.
export function Skeleton({ rows = 6, className = "" }) {
  return (
    <div className={`pb-skel${className ? " " + className : ""}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="pb-skel__row" />)}
    </div>
  );
}
