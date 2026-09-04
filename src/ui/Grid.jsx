import { useIsMobile } from "../data/hooks.js";

// Hairline grid: 1px gaps painted by the container background.
export function Grid({ cols = "1fr", colsTablet, colsMobile = "1fr", className = "", style, children }) {
  const isMobile = useIsMobile(768);
  const isTablet = useIsMobile(1024);
  const template = isMobile ? colsMobile : isTablet ? colsTablet || cols : cols;
  return (
    <div className={`pb-grid${className ? " " + className : ""}`} style={{ gridTemplateColumns: template, ...style }}>
      {children}
    </div>
  );
}

// Screen root: stacks grids and sections with a hairline between them.
export function Page({ className = "", children }) {
  return <div className={`pb-page${className ? " " + className : ""}`}>{children}</div>;
}
