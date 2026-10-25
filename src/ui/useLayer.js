import { useEffect, useId, useRef } from "react";
import { pushLayer, popLayer } from "./layers.js";

// Register the calling component as an Escape-closable layer while `open`.
// Drawers and dialogs are modal, the default. A popover passes
// { modal: false, ref }: it leaves the global shortcuts alone and closes on a
// pointerdown outside `ref`. The ref should wrap the toggle button too, or
// pressing it to close the popover would close it and then reopen it.
export function useLayer(open, onClose, { modal = true, ref = null } = {}) {
  const id = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    pushLayer(id, () => closeRef.current(), { modal });
    return () => popLayer(id);
  }, [open, id, modal]);
  useEffect(() => {
    if (!open || modal || !ref) return undefined;
    // Capture phase, so a click on something that stops propagation still
    // counts as a click outside.
    const onPointerDown = (e) => {
      const root = ref.current;
      if (root && !root.contains(e.target)) closeRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, modal, ref]);
}
