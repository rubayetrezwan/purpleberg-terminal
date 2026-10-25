import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Active traps, innermost last. A confirm dialog over the quick-look drawer
// traps Tab itself; the drawer's trap stands aside until the dialog closes.
const traps = [];

// Keep Tab inside `ref` while active. Focus starts on the container itself
// (it carries tabIndex -1) so assistive tech announces the dialog name rather
// than "Close, button"; the previous focus is restored if it still exists.
//
// Tab is watched on the document, not on the root: when the focused element
// unmounts (Enter in the quick look's alert form), focus drops to <body>,
// and a listener on the root would never see the next Tab, which then lands
// on the top bar behind the scrim.
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    const previous = document.activeElement;
    traps.push(root);
    root.focus({ preventScroll: true });
    const visible = (el) => el.offsetParent !== null || el === root;
    const onKey = (e) => {
      if (e.key !== "Tab" || traps[traps.length - 1] !== root) return;
      const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter(visible);
      if (!items.length) { e.preventDefault(); return; }
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        items[e.shiftKey ? items.length - 1 : 0].focus();
        return;
      }
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = traps.lastIndexOf(root);
      if (i >= 0) traps.splice(i, 1);
      if (previous && previous.isConnected && typeof previous.focus === "function") previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
