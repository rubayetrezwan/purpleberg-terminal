import { useRef } from "react";
import { X } from "lucide-react";
import { useStore } from "../stores/useStore.js";
import { help, closeHelp, SHORTCUTS } from "./help.js";
import { useLayer } from "../ui/useLayer.js";
import { useFocusTrap } from "../ui/focusTrap.js";
import { Kbd } from "../ui/Kbd.jsx";

export function ShortcutSheet() {
  const open = useStore(help, (s) => s.open);
  const ref = useRef(null);
  useLayer(open, closeHelp);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div className="pb-scrim pb-scrim--center" onMouseDown={(e) => { if (e.target === e.currentTarget) closeHelp(); }}>
      <div ref={ref} className="pb-sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabIndex={-1}>
        <header className="pb-drawer__head">
          <span className="pb-drawer__title">KEYBOARD</span>
          <button type="button" className="pb-reset pb-drawer__close" aria-label="Close" onClick={closeHelp}><X size={14} strokeWidth={1.5} /></button>
        </header>
        <div className="pb-sheet__body">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="pb-kv"><span className="pb-kv__k"><Kbd>{key}</Kbd></span><span className="pb-kv__v pb-dim">{what}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
