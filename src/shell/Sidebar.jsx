import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useRoute, ROUTES, pathFor } from "../router/index.jsx";
import { useIsMobile } from "../data/hooks.js";
import { useStore } from "../stores/useStore.js";
import { ui, toggleSidebar } from "../stores/ui.js";

// Label plus mnemonic per screen; collapsed shows only the mnemonic.
export function Sidebar() {
  const { route } = useRoute();
  const collapsedPref = useStore(ui, (s) => s.sidebarCollapsed);
  const isTablet = useIsMobile(1024);
  const collapsed = collapsedPref || isTablet;
  return (
    <nav className={`pb-side${collapsed ? " pb-side--collapsed" : ""}`} aria-label="Functions">
      <ul className="pb-side__list">
        {ROUTES.map((r) => {
          const active = route ? route.name === r.name : false;
          return (
            <li key={r.name}>
              <Link
                to={pathFor(r.name)}
                className={`pb-side__item${active ? " pb-side__item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? `${r.mnemonic} · ${r.label}` : r.title}
              >
                {!collapsed && <span className="pb-side__label">{r.label}</span>}
                <span className="pb-side__mn">{r.mnemonic}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!isTablet && (
        <button type="button" className="pb-reset pb-side__toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={12} strokeWidth={1.5} /> : <ChevronLeft size={12} strokeWidth={1.5} />}
        </button>
      )}
    </nav>
  );
}
