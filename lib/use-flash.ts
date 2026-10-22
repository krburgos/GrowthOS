"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Which row just saved, for the saved-row glow (client-confirmed,
 * 2026-10-22, Design System §Motion). Call `flash(id)` after a save; the
 * row with that id carries `animate-saved` for the glow's second, then the
 * flag clears so the next save can glow again.
 */
export function useFlash(ms = 1000) {
  const [flashId, setFlashId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      // Cleared first so a second save on the same row restarts the glow.
      setFlashId(null);
      requestAnimationFrame(() => setFlashId(id));
      timer.current = setTimeout(() => setFlashId(null), ms + 50);
    },
    [ms]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { flashId, flash };
}
