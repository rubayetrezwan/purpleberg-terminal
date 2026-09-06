import { useSyncExternalStore } from "react";

const identity = (s) => s;

// Select primitives or references that already exist in state. A selector
// that builds a new object on every call would re-render forever.
export function useStore(store, selector = identity) {
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
