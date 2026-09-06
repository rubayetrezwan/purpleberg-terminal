import { useEffect, useRef, useState } from "react";
import { Page, Grid } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Segmented } from "../ui/Segmented.jsx";
import { Select } from "../ui/Select.jsx";
import { Button } from "../ui/Button.jsx";
import { Input } from "../ui/Input.jsx";
import { KV, KVList } from "../ui/KV.jsx";
import { Tag } from "../ui/Tag.jsx";
import { toast } from "../ui/toasts.js";
import { confirm } from "../ui/dialog.js";
import { useStore } from "../stores/useStore.js";
import { settings, setSetting, THEMES, DENSITIES, REFRESH_OPTIONS } from "../stores/settings.js";
import { watchlist, addSymbol, removeSymbol, moveSymbol, normalizeSymbol, WATCHLIST_MAX } from "../stores/watchlist.js";
import { exportAll, importAll, resetAll } from "../stores/index.js";
import { ROUTES } from "../router/routes.js";
import { api } from "../data/api.js";

const DATA_SOURCES = [
  { name: "Yahoo Finance (unofficial)", what: "Quotes, history, fundamentals, news, search" },
  { name: "CoinGecko, CoinPaprika fallback", what: "Crypto markets and history" },
  { name: "Forex Factory", what: "Economic calendar" },
  { name: "open.er-api.com", what: "Daily FX fallback rates" },
  { name: "Finnhub (optional key)", what: "Live IPO calendar" },
];

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
// Release name follows the package version, so it cannot drift: 3.0.0 reads
// "TERMINAL V3.0". An unbuilt dev server has no version to derive from.
const RELEASE = /^\d+\.\d+/.test(VERSION)
  ? `TERMINAL V${VERSION.split(".").slice(0, 2).join(".")}`
  : "TERMINAL (DEV)";

export default function Settings() {
  const s = useStore(settings);
  const symbols = useStore(watchlist, (st) => st.symbols);
  const [newSym, setNewSym] = useState("");
  const [status, setStatus] = useState(null);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const fileRef = useRef(null);

  useEffect(() => {
    let on = true;
    api.status().then((r) => { if (on) setStatus(r); }).catch(() => { if (on) setStatus({ error: true }); });
    return () => { on = false; };
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") setSetting("notifications", true);
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purpleberg-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "DATA EXPORTED" });
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ok = await confirm({ title: "IMPORT DATA", body: "Replace your watchlist, alerts, portfolio, saved screens, and settings with the file contents?", confirmLabel: "IMPORT" });
      if (!ok) return;
      const res = importAll(data);
      toast(res.ok ? { title: "DATA IMPORTED" } : { tone: "warn", title: "IMPORT FAILED", body: res.error });
    } catch {
      toast({ tone: "warn", title: "IMPORT FAILED", body: "Not valid JSON" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doReset = async () => {
    const ok = await confirm({ title: "RESET ALL LOCAL DATA", body: "Watchlist, alerts, portfolio, saved screens, and settings go back to defaults. This cannot be undone.", confirmLabel: "RESET", danger: true });
    if (ok) { resetAll(); toast({ title: "LOCAL DATA RESET" }); }
  };

  const addWatch = (e) => {
    e.preventDefault();
    const sym = normalizeSymbol(newSym);
    if (!sym) { toast({ tone: "warn", title: "INVALID SYMBOL" }); return; }
    addSymbol(sym);
    setNewSym("");
  };

  const keyTag = (configured, offLabel) => (
    status ? (status.error ? "—" : <Tag tone={configured ? "up" : undefined}>{configured ? "CONFIGURED" : offLabel}</Tag>) : "…"
  );

  return (
    <Page>
      <Grid cols="1fr 1fr" colsMobile="1fr">
        <Section mnemonic="SET" title="Appearance">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">THEME</span>
              <Segmented label="Theme" value={s.theme} onChange={(v) => setSetting("theme", v)} options={THEMES.map((t) => ({ value: t, label: t.toUpperCase() }))} />
            </div>
            <div className="pb-form__row">
              <span className="pb-form__label">DENSITY</span>
              <Segmented label="Density" value={s.density} onChange={(v) => setSetting("density", v)} options={DENSITIES.map((d) => ({ value: d, label: d.toUpperCase() }))} />
            </div>
          </div>
        </Section>

        <Section title="Data">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">REFRESH</span>
              <Segmented label="Refresh rate" value={String(s.refreshSec)} onChange={(v) => setSetting("refreshSec", Number(v))} options={REFRESH_OPTIONS.map((r) => ({ value: String(r), label: `${r}S` }))} />
            </div>
            <div className="pb-form__row">
              <span className="pb-form__label">DEFAULT SCREEN</span>
              <Select aria-label="Default screen" value={s.defaultScreen} onChange={(v) => setSetting("defaultScreen", v)} options={ROUTES.map((r) => ({ value: r.mnemonic, label: `${r.mnemonic} · ${r.label}` }))} />
            </div>
            <div className="pb-form__hint pb-muted">Every poll scales with the refresh rate. 15s is what the proxy is tuned for.</div>
          </div>
        </Section>

        <Section title="Alerts">
          <div className="pb-form">
            <div className="pb-form__row">
              <span className="pb-form__label">BROWSER NOTIFICATIONS</span>
              {perm === "granted" ? (
                <Segmented label="Notifications" value={s.notifications ? "on" : "off"} onChange={(v) => setSetting("notifications", v === "on")} options={[{ value: "on", label: "ON" }, { value: "off", label: "OFF" }]} />
              ) : perm === "denied" ? (
                <span className="pb-warn">BLOCKED IN BROWSER</span>
              ) : perm === "unsupported" ? (
                <span className="pb-muted">NOT SUPPORTED</span>
              ) : (
                <Button onClick={requestNotifications}>ENABLE</Button>
              )}
            </div>
            <div className="pb-form__hint pb-muted">Alerts always show in the app. Notifications also fire while the tab is in the background.</div>
          </div>
        </Section>

        <Section title="Watchlist" meta={`${symbols.length} / ${WATCHLIST_MAX}`}>
          <form className="pb-form__row" onSubmit={addWatch}>
            <Input mono value={newSym} onChange={(e) => setNewSym(e.target.value)} placeholder="ADD SYMBOL" aria-label="Add symbol" style={{ maxWidth: 160 }} />
            <Button type="submit" variant="primary">ADD</Button>
          </form>
          <ul className="pb-watchlist">
            {symbols.map((sym, i) => (
              <li key={sym} className="pb-watchlist__row">
                <span className="pb-muted">{i + 1})</span>
                <span className="pb-watchlist__sym">{sym}</span>
                <span className="pb-watchlist__tools">
                  <Button size="sm" onClick={() => moveSymbol(sym, -1)} disabled={i === 0} aria-label={`Move ${sym} up`}>▲</Button>
                  <Button size="sm" onClick={() => moveSymbol(sym, 1)} disabled={i === symbols.length - 1} aria-label={`Move ${sym} down`}>▼</Button>
                  <Button size="sm" variant="danger" onClick={() => removeSymbol(sym)} aria-label={`Remove ${sym}`}>DEL</Button>
                </span>
              </li>
            ))}
            {!symbols.length && <li className="pb-muted pb-watchlist__empty">Empty. Star any ticker to add it.</li>}
          </ul>
        </Section>

        <Section title="Storage">
          <div className="pb-form">
            <div className="pb-form__row">
              <Button onClick={doExport}>EXPORT JSON</Button>
              <Button onClick={() => fileRef.current && fileRef.current.click()}>IMPORT JSON</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="pb-sr-only" onChange={(e) => doImport(e.target.files && e.target.files[0])} aria-label="Import file" />
              <Button variant="danger" onClick={doReset}>RESET ALL</Button>
            </div>
            <div className="pb-form__hint pb-muted">Everything lives in this browser only: watchlist, alerts, portfolio, saved screens, settings.</div>
          </div>
        </Section>

        <Section title="About">
          <KVList>
            <KV k="RELEASE" v={RELEASE} />
            <KV k="VERSION" v={VERSION} />
            <KV k="BUILT BY" v="Rubayet Rezwan" />
            <KV k="FINNHUB KEY" v={keyTag(status && status.finnhub, "NOT SET")} />
            <KV k="COINGECKO KEY" v={keyTag(status && status.coingecko, "PUBLIC TIER")} />
          </KVList>
          <div className="pb-about">
            <div className="pb-label">DATA SOURCES</div>
            <ul className="pb-about__list">
              {DATA_SOURCES.map((d) => <li key={d.name}><span>{d.name}</span><span className="pb-muted">{d.what}</span></li>)}
            </ul>
            <div className="pb-about__disclaimer pb-muted">
              Educational project. Yahoo Finance endpoints are unofficial and not licensed for redistribution. Do not trade on this data.
            </div>
          </div>
        </Section>
      </Grid>
    </Page>
  );
}
