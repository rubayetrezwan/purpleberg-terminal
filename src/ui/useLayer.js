import { useEffect, useId, useRef } from "react";
import { pushLayer, popLayer } from "./layers.js";

// Register the calling component as an Escape-closable layer while `open`.
export function useLayer(open, onClose) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    pushLayer(id, () => closeRef.current());
    return () => popLayer(id);
  }, [open, id]);
}
