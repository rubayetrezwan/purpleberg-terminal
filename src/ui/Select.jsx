// options: [{ value, label }]
export function Select({ options = [], value, onChange, className = "", ...rest }) {
  return (
    <select className={`pb-select${className ? " " + className : ""}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
