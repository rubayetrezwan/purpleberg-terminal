// Stack of open floating layers (command line, popovers, drawer, dialogs,
// sheet). Escape closes the top-most one; each layer registers its own
// close handler. No React here; the hook is below in the same file's sibling.
//
// Drawers, dialogs and the shortcut sheet are modal: while one is open it owns
// the keyboard. The command line and the top-bar popovers are not, so a
// popover left open never kills the global shortcuts, and opening one closes
// any other, so two never sit on top of each other.
const stack = [];

export function pushLayer(id, onClose, { modal = true } = {}) {
  popLayer(id);
  if (!modal) {
    for (const other of stack.filter((l) => !l.modal)) closeLayer(other);
  }
  stack.push({ id, onClose, modal });
  return () => popLayer(id);
}

export function popLayer(id) {
  const i = stack.findIndex((l) => l.id === id);
  if (i >= 0) stack.splice(i, 1);
}

function closeLayer(layer) {
  popLayer(layer.id);
  try {
    layer.onClose();
    return true;
  } catch (e) {
    stack.push(layer); // still on screen: keep it on the stack so Escape targets it again
    console.error("[layers] close handler failed", e);
    return false;
  }
}

export function closeTopLayer() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  closeLayer(top);
  return true;
}

export function layerCount() {
  return stack.length;
}

export function hasModalLayer() {
  return stack.some((l) => l.modal);
}

export function topLayerId() {
  return stack.length ? stack[stack.length - 1].id : null;
}
