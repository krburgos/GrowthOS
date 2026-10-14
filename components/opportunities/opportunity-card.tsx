"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

import { daysSince, usd } from "@/lib/companies/value";
import { cn } from "@/lib/utils";

export interface OpportunityCardData {
  id: string;
  name: string | null;
  contact_name: string;
  company_name: string | null;
  /** The company's Employees, for the formula and the "· 85 employees" line. */
  employees: number;
  /** $200 × Employees × 12 (lib/companies/value.ts). */
  prospect_value: number;
  win_probability: number;
  owner_name: string | null;
  stage_entered_at: string;
}

function ownerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Design System §8.4 — Opportunity Kanban Board card. White bg,
 * radius-md, shadow-sm at rest / shadow-md while dragging, 1px
 * neutral-200 border, a hover-lift so the board reads as interactive, and
 * a visible keyboard focus ring (dnd-kit's attributes make it focusable).
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "CRM Pages
 * Refresh"): the card leads with the opportunity's name, then contact and
 * company with its Employees. The figure is **Prospect Value** ($200 ×
 * Employees × 12) with Opportunities Value (3×) beneath it. The typed
 * Value field is no longer shown here, by the client's direction. A
 * win-probability bar replaces the plain pill, and the footer says how
 * long the opportunity has been in this stage.
 */
export function OpportunityCard({ opportunity: o, open }: { opportunity: OpportunityCardData; open: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: o.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const title = o.name?.trim() || o.contact_name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-full cursor-grab flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isDragging && "z-10 -translate-y-0.5 shadow-md"
      )}
    >
      <Link
        href={`/opportunities/${o.id}`}
        className="text-body-sm font-semibold leading-snug text-neutral-900 hover:underline"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {title}
      </Link>
      <span className="truncate text-caption text-neutral-500">
        {[title !== o.contact_name ? o.contact_name : null, o.company_name, o.employees ? `${o.employees} employees` : null]
          .filter(Boolean)
          .join(" · ") || "No company"}
      </span>

      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-body font-bold tabular-nums text-primary-900" title="Prospect Value: $200 × Employees × 12">
          {usd.format(o.prospect_value)}
        </span>
        {open && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption font-semibold tabular-nums text-neutral-600">
            <span aria-hidden="true" className="block h-1.5 w-9 overflow-hidden rounded-full bg-neutral-100">
              <span className="block h-full rounded-full bg-secondary-600" style={{ width: `${o.win_probability}%` }} />
            </span>
            {o.win_probability}%
          </span>
        )}
      </div>
      <span className="text-caption tabular-nums text-neutral-500">
        Opportunities Value {usd.format(o.prospect_value * 3)}
      </span>

      <div className="mt-0.5 flex items-center justify-between border-t border-neutral-100 pt-1.5 text-caption text-neutral-400">
        <span title="Days since this opportunity entered its current stage">
          {daysSince(o.stage_entered_at) === "Today" ? "Entered this stage today" : `${daysSince(o.stage_entered_at)} in this stage`}
        </span>
        {o.owner_name && (
          <span
            title={o.owner_name}
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700"
          >
            {ownerInitials(o.owner_name)}
          </span>
        )}
      </div>
    </div>
  );
}
