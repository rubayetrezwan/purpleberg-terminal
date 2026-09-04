// Tiny bus so the global keyboard layer can focus the command line without
// a React ref threading through the shell.
let handler = null;

export function registerCommandLine(fn) {
  handler = fn;
  return () => { if (handler === fn) handler = null; };
}

export function focusCommandLine(prefill = "") {
  if (handler) handler(prefill);
}
