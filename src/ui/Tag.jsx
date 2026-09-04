// Square outline label: exchange, market state, IPO status, impact.
export function Tag({ tone, title, className = "", children }) {
  return (
    <span className={`pb-tag${tone ? ` pb-tag--${tone}` : ""}${className ? " " + className : ""}`} title={title}>
      {children}
    </span>
  );
}
