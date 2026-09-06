import { createContext, useContext } from "react";

// True inside a DataTable that is keyboard-navigable (role="grid"). In-cell
// controls whose action the grid already owns take tabIndex -1 there, so Tab
// moves between rows instead of walking every button in the table — the ARIA
// grid pattern. Outside a grid the same controls are ordinary tab stops.
export const GridContext = createContext(false);

export const useInGrid = () => useContext(GridContext);
