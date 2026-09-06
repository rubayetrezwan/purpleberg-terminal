import { createStore } from "../stores/createStore.js";
import { FEED_INITIAL, nextFeedState } from "./feedState.js";

// In-memory only: never persisted, never shared across tabs.
export const feedStatus = createStore("feed", FEED_INITIAL, { storage: null, debounceMs: 0 });

export function reportPoll(ok, now = Date.now()) {
  feedStatus.update((s) => nextFeedState(s, ok, now));
}
