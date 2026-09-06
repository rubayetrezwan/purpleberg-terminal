import { useIsMobile } from "../data/hooks.js";
import { Select } from "./Select.jsx";

// Desktop: list left, detail right. Mobile: a native selector above the detail.
// mobile: { label, options: [{ value, label }], value, onChange }
export function ListDetail({ list, detail, listWidth = 220, mobile, className = "" }) {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return (
      <div className={`pb-ld pb-ld--mobile${className ? " " + className : ""}`}>
        {mobile && (
          <div className="pb-ld__selector">
            <Select aria-label={mobile.label} options={mobile.options} value={mobile.value} onChange={mobile.onChange} />
          </div>
        )}
        <div className="pb-ld__detail">{detail}</div>
      </div>
    );
  }
  return (
    <div className={`pb-ld${className ? " " + className : ""}`} style={{ gridTemplateColumns: `${listWidth}px minmax(0, 1fr)` }}>
      <div className="pb-ld__list">{list}</div>
      <div className="pb-ld__detail">{detail}</div>
    </div>
  );
}
