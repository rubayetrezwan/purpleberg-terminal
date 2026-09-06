import { Link, useRoute } from "../router/index.jsx";
import { useIsMobile } from "../data/hooks.js";
import { CommandLine } from "./CommandLine.jsx";
import { AlertsBell } from "./AlertsBell.jsx";
import { SessionClock } from "./SessionClock.jsx";
import { Clock } from "./Clock.jsx";

export function TopBar() {
  const { route } = useRoute();
  const isMobile = useIsMobile(768);
  return (
    <header className="pb-top" role="banner">
      <Link to="/" className="pb-top__brand" aria-label="Purpleberg, dashboard">
        <span className="pb-top__mark" aria-hidden="true" />PURPLEBERG
      </Link>
      {!isMobile && (
        <span className="pb-top__crumb">
          <span className="pb-accent">{route ? route.mnemonic : "?"}</span>
          <span className="pb-muted"> · </span>
          {route ? route.label : "Unknown function"}
        </span>
      )}
      <CommandLine />
      <AlertsBell />
      <SessionClock compact={isMobile} />
      {!isMobile && <Clock />}
    </header>
  );
}
