import { useIsMobile } from "../data/hooks.js";
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
  return (
    <div className="pb-app">
      <TopBar />
      <OfflineBanner />
      <div className="pb-app__body">
        {!isMobile && <Sidebar />}
        <main id="main" className="pb-app__main" tabIndex={-1}>{children}</main>
      </div>
      {isMobile ? <MobileTabs /> : <BottomTape />}
      <Toasts />
      <DialogHost />
      <ShortcutSheet />
    </div>
  );
}
