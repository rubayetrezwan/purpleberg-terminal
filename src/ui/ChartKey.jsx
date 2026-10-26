// A compact chart legend: one swatch per series in its chart colour, as a
// square (bars), a solid line or a dashed line. Recharts' own legend draws
// circle markers that read as decoration.
export function ChartKey({ items, className = "" }) {
  return (
    <span className={`pb-key${className ? " " + className : ""}`}>
      {items.map((it) => (
        <span key={it.label} className="pb-key__item">
          <i
            className={it.dashed ? "pb-key__swatch pb-key__swatch--dash" : it.line ? "pb-key__swatch pb-key__swatch--line" : "pb-key__swatch"}
            style={{ color: it.color }}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </span>
  );
}
