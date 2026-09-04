import { createStore } from "../stores/createStore.js";

export const help = createStore("help", { open: false }, { storage: null, debounceMs: 0 });
export const openHelp = () => help.set({ open: true });
export const closeHelp = () => help.set({ open: false });

export const SHORTCUTS = [
  ["/", "Focus the command line"],
  ["Ctrl K", "Focus the command line"],
  ["Any letter or digit", "Start typing in the command line"],
  ["Enter", "GO: run the command or open the highlighted suggestion"],
  ["Shift Enter", "Open the highlighted symbol in quick look instead"],
  ["Esc", "Close the top-most layer"],
  ["?", "This sheet"],
  ["Up / Down", "Move in a list"],
  ["1 to 9", "Open the nth visible row of the focused list"],
  ["Space", "Star the focused row (watchlist)"],
  ["DES AAPL", "Command line: open Apple in Equities"],
  ["AAPL DES", "Same, Bloomberg order"],
  ["THEME / DENSITY / HELP", "Commands"],
];
