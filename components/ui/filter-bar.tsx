import { Filter, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The pieces every table's filter row is built from (client-confirmed,
 * 2026-10-15, approved mockup "Table Filters"). The client's boss could not
 * tell the old controls were filters: dropdowns reading "All owners" and
 * bare Must/Should/Could pills said nothing about what they did. So the row
 * now opens with a funnel and the word "Filter", each control carries its
 * name above it, a control that is filtering turns blue, and a filtered
 * table says "Showing 8 of 14 orders" with a way back.
 *
 * `tone="blue"` sits on the Mission Orders table's light blue bar;
 * `tone="plain"` on the white CRM toolbars.
 */
type Tone = "blue" | "plain";

export function FilterTitle() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 pr-0.5 text-body-sm font-bold text-primary-900">
      <Filter className="size-4 text-secondary-700" aria-hidden="true" />
      Filter
    </span>
  );
}

export function FilterField({
  label,
  tone = "plain",
  className,
  children,
}: {
  label: string;
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span
        className={cn(
          "text-[11px] font-bold uppercase leading-none tracking-wide",
          tone === "blue" ? "text-primary-700" : "text-neutral-500"
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** For a SelectTrigger: blue when the control is narrowing the table. */
export function filterTriggerClass(active: boolean) {
  return active ? "border-primary-700 bg-primary-50 font-semibold text-primary-900" : "bg-white";
}

export function FilterResult({
  shown,
  total,
  noun,
  onClear,
}: {
  shown: number;
  total: number;
  noun: string;
  onClear: () => void;
}) {
  return (
    <p className="flex basis-full flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-neutral-600" aria-live="polite">
      <span>
        Showing <b className="font-semibold tabular-nums text-primary-900">{shown.toLocaleString()}</b> of{" "}
        <b className="font-semibold tabular-nums text-primary-900">{total.toLocaleString()}</b> {noun}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded font-semibold text-secondary-700 hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        <X className="size-3.5" aria-hidden="true" />
        Clear filters
      </button>
    </p>
  );
}
