import { createContext, useContext } from "react";

// Provided by features/quickLook.jsx. Default is a no-op so kit components
// render safely in isolation.
export const QuickLookContext = createContext({ symbol: null, open: () => {}, close: () => {} });

export function useQuickLook() {
  return useContext(QuickLookContext);
}
