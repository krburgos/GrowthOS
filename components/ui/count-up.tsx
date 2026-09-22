"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A number that counts up to its value (client-confirmed, 2026-09-22, for the
 * GOS Dashboard KPI band).
 *
 * Three things keep it cheap and quiet:
 *
 * - It renders the real value on the first pass, so the server HTML and the
 *   first client render agree; the run to zero happens in a layout effect,
 *   before the browser paints, so there is no flash of the final figure.
 * - It animates on mount and whenever the value actually changes, not on
 *   every re-render, so a router.refresh() that returns the same figure
 *   leaves the number sitting still.
 * - It respects prefers-reduced-motion by skipping straight to the value.
 *
 * One rAF loop per number for well under a second is not a load the page
 * notices; the band's eight numbers finish before a reader has focused on
 * them.
 */

const DURATION_MS = 900;

/** useLayoutEffect warns when React renders on the server; useEffect is the harmless stand-in there. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;

    if (from === value) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }

    setShown(from);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setShown(Math.round(from + (value - from) * easeOutCubic(t)));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  // Assistive tech reads the settled figure rather than every frame of the count.
  return (
    <span className={className} aria-label={value.toLocaleString()}>
      <span aria-hidden="true">{shown.toLocaleString()}</span>
    </span>
  );
}
