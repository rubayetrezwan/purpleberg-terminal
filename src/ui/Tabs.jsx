// tabs: string[] or [{ value, label }]
export function Tabs({ tabs, active, onChange, label, className = "" }) {
  return (
    <div className={`pb-tabs${className ? " " + className : ""}`} role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const tab = typeof t === "string" ? { value: t, label: t } : t;
        const on = tab.value === active;
        return (
          <button key={tab.value} type="button" role="tab" aria-selected={on} className={`pb-tabs__tab${on ? " pb-tabs__tab--on" : ""}`} onClick={() => onChange(tab.value)}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
