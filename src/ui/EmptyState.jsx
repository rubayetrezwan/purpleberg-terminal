export function EmptyState({ action, className = "", children }) {
  return (
    <div className={`pb-empty${className ? " " + className : ""}`}>
      <div className="pb-empty__msg">{children}</div>
      {action && <div className="pb-empty__action">{action}</div>}
    </div>
  );
}
