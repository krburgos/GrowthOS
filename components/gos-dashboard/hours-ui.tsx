import { Check, X } from "lucide-react";

import { paceTone } from "@/lib/gos-dashboard/hours";
import { cn } from "@/lib/utils";

/** Achieved-vs-committed bar; the dark tick marks how much of the quarter has passed. */
export function HoursBar({ pct, elapsedPct, className }: { pct: number; elapsedPct: number; className?: string }) {
  const tone = paceTone(pct, elapsedPct);
  return (
    <div className={cn("relative h-2 rounded-full bg-neutral-100", className)} aria-hidden="true">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          tone === "over" ? "bg-success-600" : tone === "behind" ? "bg-warning-400" : "bg-secondary-500"
        )}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      <div className="absolute -inset-y-[3px] w-0.5 rounded-sm bg-primary-900/55" style={{ left: `${elapsedPct}%` }} />
    </div>
  );
}

/** Client-confirmed (2026-09-17): always reads "Outsourced" — green with a check when yes, red with an X when no. */
export function OutsourcedChip({ outsourced }: { outsourced: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1 pr-2.5 text-caption font-semibold",
        outsourced ? "bg-success-100 text-success-700" : "bg-error-100 text-error-700"
      )}
      aria-label={outsourced ? "Outsourced: yes" : "Outsourced: no"}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full text-white",
          outsourced ? "bg-success-600" : "bg-error-600"
        )}
      >
        {outsourced ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
      </span>
      Outsourced
    </span>
  );
}
