import { useNow } from "./useNow.js";
import { useStore } from "../stores/useStore.js";
import { feedStatus } from "../data/feedStatus.js";
import { freshnessState } from "./freshness.js";

export function Freshness({ updatedAt, intervalMs = 15000, className = "" }) {
  const now = useNow();
  const online = useStore(feedStatus, (s) => s.status === "online");
  const f = freshnessState(updatedAt, now, intervalMs, online);
  return <span className={`pb-fresh pb-${f.tone}${className ? " " + className : ""}`}>{f.label}</span>;
}
