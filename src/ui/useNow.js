import { useSyncExternalStore } from "react";

// One shared 1s ticker for every clock, countdown, and freshness label.
let now = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  now = Date.now();
  for (const fn of [...listeners]) fn();
}

function subscribe(fn) {
  now = Date.now();
  listeners.add(fn);
  if (!timer) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}

const get = () => now;

export function useNow() {
  return useSyncExternalStore(subscribe, get, get);
}
