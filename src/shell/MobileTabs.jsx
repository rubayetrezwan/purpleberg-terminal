import { useState } from "react";
import { Link, useRoute, ROUTES, pathFor, routeByName, MOBILE_TAB_NAMES } from "../router/index.jsx";
import { Drawer } from "../ui/Drawer.jsx";

export function MobileTabs() {
  const { route } = useRoute();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <nav className="pb-mtabs" aria-label="Primary">
        {MOBILE_TAB_NAMES.map((name) => {
          const r = routeByName(name);
          const active = route ? route.name === name : false;
          return (
            <Link key={name} to={pathFor(name)} className={`pb-mtabs__tab${active ? " pb-mtabs__tab--on" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="pb-mtabs__mn">{r.mnemonic}</span>
              <span className="pb-mtabs__lbl">{r.label}</span>
            </Link>
          );
        })}
        <button type="button" className={`pb-reset pb-mtabs__tab${menu ? " pb-mtabs__tab--on" : ""}`} onClick={() => setMenu(true)} aria-haspopup="dialog">
          <span className="pb-mtabs__mn">MENU</span>
          <span className="pb-mtabs__lbl">All</span>
        </button>
      </nav>
      <Drawer open={menu} onClose={() => setMenu(false)} title="FUNCTIONS">
        <ul className="pb-menu">
          {ROUTES.map((r) => (
            <li key={r.name}>
              <Link to={pathFor(r.name)} className={`pb-menu__item${route && route.name === r.name ? " pb-menu__item--on" : ""}`} onClick={() => setMenu(false)}>
                <span className="pb-menu__mn">{r.mnemonic}</span>
                <span>{r.label}</span>
                <span className="pb-muted pb-menu__title">{r.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}
