"use client";

import { useSyncExternalStore } from "react";

/**
 * The viewer's clock, for anything worked out from "now" (what is due
 * today, today's calls). Read without a setState-in-effect.
 *
 * The server and the first client render see `null`, so markup matches on
 * hydration; React then re-renders with the time, which is what the old
 * `useEffect(() => setNow(new Date()), [])` did. It also moves on once a
 * minute while a screen using it is open, so "today" does not go stale
 * over midnight.
 */
const TICK_MS = 60_000;

let current: Date | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = new Date();
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) {
    // First screen to look: start from the real time, not one left over
    // from an earlier page.
    current = new Date();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (!current) current = new Date();
  return current;
}

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
