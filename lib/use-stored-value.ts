"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A per-browser remembered setting (a hidden strip, a collapsed rail, a
 * chosen view), read without a setState-in-effect.
 *
 * The server and the first client render see `null`, so markup matches on
 * hydration; React then re-renders with the stored value, which is what the
 * old mount effect did. Writes notify every component using the same key on
 * the page, and the `storage` event keeps other tabs in step. Blocked storage
 * falls back to an in-memory copy for this page view, never an error.
 *
 * Same approach as the opportunities table's saved column layout
 * (components/opportunities/opportunity-list-table.tsx).
 */
const listeners = new Set<() => void>();
/** Holds a choice when storage is blocked, so a toggle still works for this page view. */
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );
  const write = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage blocked: `memory` keeps the choice for this page view.
      }
      listeners.forEach((l) => l());
    },
    [key]
  );
  return [value, write];
}
