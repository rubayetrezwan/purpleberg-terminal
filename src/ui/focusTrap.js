import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keep Tab inside `ref` while active; restore the previous focus afterwards.
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    const previous = document.activeElement;
    const first = root.querySelector(FOCUSABLE);
    (first || root).focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function") previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
