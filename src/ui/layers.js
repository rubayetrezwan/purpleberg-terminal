// Stack of open floating layers (command line, popovers, drawer, dialogs,
// sheet). Escape closes the top-most one; each layer registers its own
// close handler. No React here; the hook is below in the same file's sibling.
const stack = [];

export function pushLayer(id, onClose) {
  popLayer(id);
  stack.push({ id, onClose });
  return () => popLayer(id);
}

export function popLayer(id) {
  const i = stack.findIndex((l) => l.id === id);
  if (i >= 0) stack.splice(i, 1);
}

export function closeTopLayer() {
  const top = stack.pop();
  if (!top) return false;
  top.onClose();
  return true;
}

export function layerCount() {
  return stack.length;
}

export function topLayerId() {
  return stack.length ? stack[stack.length - 1].id : null;
}
