import { useRef } from "react";
import { X } from "lucide-react";
import { useLayer } from "./useLayer.js";
import { useFocusTrap } from "./focusTrap.js";

// Right-hand sheet. `header` replaces the default title bar when given.
export function Drawer({ open, onClose, title, header, ariaLabel, width, className = "", children }) {
  const ref = useRef(null);
  useLayer(open, onClose);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div className="pb-scrim pb-scrim--right" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        ref={ref}
        className={`pb-drawer${className ? " " + className : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : "Panel")}
        style={width ? { width } : undefined}
        tabIndex={-1}
      >
        {header || (
          <header className="pb-drawer__head">
            <span className="pb-drawer__title">{title}</span>
            <button type="button" className="pb-reset pb-drawer__close" aria-label="Close" onClick={onClose}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </header>
        )}
        <div className="pb-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
