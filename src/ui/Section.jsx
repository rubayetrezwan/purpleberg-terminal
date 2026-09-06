import { useIsMobile } from "../data/hooks.js";

// A hairline-bordered region with an uppercase accent title. Inside a <Grid>
// the grid supplies the hairlines; `span` spreads it across columns on desktop
// only (tablet and mobile column counts differ, so spans are dropped there).
export function Section({ title, mnemonic, meta, actions, flush = false, span, id, className = "", style, children }) {
  const narrow = useIsMobile(1024);
  const gridStyle = span && !narrow ? { gridColumn: span === "all" ? "1 / -1" : `span ${span}` } : undefined;
  const hasHead = Boolean(title || mnemonic || meta || actions);
  return (
    <section id={id} className={`pb-section${flush ? " pb-section--flush" : ""}${className ? " " + className : ""}`} style={{ ...gridStyle, ...style }}>
      {hasHead && (
        <header className="pb-section__head">
          {(title || mnemonic) && (
            <h2 className="pb-section__title">
              {mnemonic && <span className="pb-section__mn">{mnemonic}</span>}
              {title}
            </h2>
          )}
          {meta && <div className="pb-section__meta">{meta}</div>}
          {actions && <div className="pb-section__actions">{actions}</div>}
        </header>
      )}
      <div className="pb-section__body">{children}</div>
    </section>
  );
}
