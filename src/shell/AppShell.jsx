import { useIsMobile } from "../data/hooks.js";
import { useRoute } from "../router/index.jsx";
import { TopBar } from "./TopBar.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { BottomTape } from "./BottomTape.jsx";
import { MobileTabs } from "./MobileTabs.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";
import { ShortcutSheet } from "./ShortcutSheet.jsx";
import { Toasts } from "../ui/Toasts.jsx";
import { DialogHost } from "../ui/Dialog.jsx";

export function AppShell({ children }) {
  const isMobile = useIsMobile(768);
  const { route } = useRoute();
  return (
    <div className="pb-app">
      <TopBar />
      <OfflineBanner />
      <div className="pb-app__body">
        {!isMobile && <Sidebar />}
        <main id="main" className="pb-app__main" tabIndex={-1}>
          {/* Sections are h2, so the document needs an h1 to start from. The
              terminal has no room for a page title, and the top bar already
              names the screen, so it is for screen readers only. */}
          <h1 className="pb-sr-only">
            {route ? `${route.mnemonic} · ${route.title}` : "Purpleberg Terminal"}
          </h1>
          {children}
        </main>
      </div>
      {isMobile ? <MobileTabs /> : <BottomTape />}
      <Toasts />
      <DialogHost />
      <ShortcutSheet />
    </div>
  );
}
