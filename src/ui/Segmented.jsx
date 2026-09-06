// options: [{ value, label, disabled? }]
export function Segmented({ options = [], value, onChange, label, size = "md", className = "" }) {
  return (
    <div className={`pb-seg pb-seg--${size}${className ? " " + className : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pb-seg__btn${o.value === value ? " pb-seg__btn--on" : ""}`}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
