// Key-value row. Keys are uppercase muted labels, values right-aligned.
export function KV({ k, v, tone, title }) {
  return (
    <div className="pb-kv" title={title}>
      <span className="pb-kv__k">{k}</span>
      <span className={`pb-kv__v${tone ? ` pb-${tone}` : ""}`}>{v}</span>
    </div>
  );
}

export function KVList({ cols = 1, className = "", children }) {
  return (
    <div className={`pb-kvlist${className ? " " + className : ""}`} style={cols > 1 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  );
}
