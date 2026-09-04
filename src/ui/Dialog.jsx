import { useRef, useSyncExternalStore } from "react";
import { getDialog, subscribeDialog, settleDialog } from "./dialog.js";
import { useLayer } from "./useLayer.js";
import { useFocusTrap } from "./focusTrap.js";
import { Button } from "./Button.jsx";

export function DialogHost() {
  const d = useSyncExternalStore(subscribeDialog, getDialog, getDialog);
  const ref = useRef(null);
  const open = Boolean(d);
  useLayer(open, () => settleDialog(false));
  useFocusTrap(ref, open);
  if (!d) return null;
  return (
    <div className="pb-scrim pb-scrim--center" onMouseDown={(e) => { if (e.target === e.currentTarget) settleDialog(false); }}>
      <div ref={ref} className="pb-dialogbox" role="alertdialog" aria-modal="true" aria-labelledby="pb-dialog-title" tabIndex={-1}>
        <div id="pb-dialog-title" className="pb-dialogbox__title">{d.title}</div>
        {d.body && <div className="pb-dialogbox__body">{d.body}</div>}
        <div className="pb-dialogbox__actions">
          <Button onClick={() => settleDialog(false)}>{d.cancelLabel}</Button>
          <Button variant={d.danger ? "danger" : "primary"} onClick={() => settleDialog(true)}>{d.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
