import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { getToasts, subscribeToasts, dismissToast } from "./toasts.js";

// The live region is always mounted (even empty) so screen readers announce
// toasts that arrive later; each toast is plain content inside it.
export function Toasts() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <div className="pb-toasts" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className={`pb-toast pb-toast--${t.tone}`}>
          <div className="pb-toast__text">
            <div className="pb-toast__title">{t.title}</div>
            {t.body && <div className="pb-toast__body">{t.body}</div>}
          </div>
          {t.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="pb-reset pb-toast__action"
              onClick={() => { try { a.run(); } finally { dismissToast(t.id); } }}
            >
              {a.label}
            </button>
          ))}
          <button type="button" className="pb-reset pb-toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
