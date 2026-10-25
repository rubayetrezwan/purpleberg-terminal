import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useIsMobile } from "../data/hooks.js";
import { Select } from "./Select.jsx";
import { Drawer } from "./Drawer.jsx";

// Desktop: list left, detail right. Mobile: a selector above the detail.
// mobile: { label, options: [{ value, label }], value, onChange }
//
// A long list (Equities has about 700 rows) is unusable in a native select on
// a phone, so `mobile.sheet` swaps the select for a button that opens the
// desktop list itself, filter and all, in a full-height sheet:
// mobile: { label, value, display, sheet: true }
// `fillList`: the list's table uses height="fill" and should run the full
// height of the column.
export function ListDetail({ list, detail, listWidth = 220, mobile, fillList = false, className = "" }) {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return (
      <div className={`pb-ld pb-ld--mobile${className ? " " + className : ""}`}>
        {mobile && (mobile.sheet ? (
          <SheetPicker mobile={mobile} list={list} />
        ) : (
          <div className="pb-ld__selector">
            <Select aria-label={mobile.label} options={mobile.options} value={mobile.value} onChange={mobile.onChange} />
          </div>
        ))}
        <div className="pb-ld__detail">{detail}</div>
      </div>
    );
  }
  return (
    <div className={`pb-ld${className ? " " + className : ""}`} style={{ gridTemplateColumns: `${listWidth}px minmax(0, 1fr)` }}>
      <div className={`pb-ld__list${fillList ? " pb-ld__list--fill" : ""}`}>{list}</div>
      <div className="pb-ld__detail">{detail}</div>
    </div>
  );
}

function SheetPicker({ mobile, list }) {
  const [open, setOpen] = useState(false);
  // Picking a row navigates, which changes the value: that is the close.
  useEffect(() => { setOpen(false); }, [mobile.value]);
  return (
    <>
      <div className="pb-ld__selector">
        <button
          type="button"
          className="pb-reset pb-select pb-ld__trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${mobile.label}: ${mobile.display}. Search`}
          onClick={() => setOpen(true)}
        >
          <span className="pb-ld__trigger-text">{mobile.display}</span>
          <Search size={13} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={mobile.label} className="pb-ld__sheet">
        {/* Picking the security already on screen changes nothing, so the
            value-change close above never fires: a row click closes too. */}
        <div onClick={(e) => { if (e.target.closest(".pb-dt__tr--click")) setOpen(false); }}>
          {list}
        </div>
      </Drawer>
    </>
  );
}
