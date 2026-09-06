import { closeTopLayer, layerCount } from "../ui/layers.js";
import { focusCommandLine } from "./commandLine.js";
import { openHelp } from "./help.js";

function isEditable(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

// Global keys, on a bubble-phase window listener. Tables and the command line
// stop propagation for the keys they consume, so anything reaching here is
// unclaimed. A capture-phase listener would swallow their digits instead.
export function installKeyboard() {
  const handler = (e) => {
    if (e.key === "Escape") {
      if (closeTopLayer()) e.preventDefault();
      return;
    }
    // A modal layer owns the keyboard while it is open. Without this, a letter
    // key inside the quick-look drawer, a confirm dialog, or the shortcut sheet
    // focused the command line behind the scrim — out of an aria-modal layer
    // that the focus trap cannot pull it back into, since the trap only
    // intercepts Tab. Escape above is the way out.
    if (layerCount() > 0) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusCommandLine("");
      return;
    }
    if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); focusCommandLine(""); return; }
    if (e.key === "?") { e.preventDefault(); openHelp(); return; }
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      e.preventDefault();
      focusCommandLine(e.key.toUpperCase());
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
