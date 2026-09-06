"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface OpportunityCardData {
  id: string;
  contact_name: string;
  company_name: string | null;
  value: number | null;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Design System §8.4 — Opportunity Kanban Board card. White bg,
 * radius-md, shadow-sm at rest / shadow-md while dragging, 16px
 * padding, 1px neutral-200 border. Cards stay neutral — only column
 * headers carry stage color.
 *
 * Client-confirmed modernization pass (approved mockup): a hover-lift
 * (subtle -translate-y + deeper shadow) so the board reads as
 * interactive even before a drag starts.
 */
export function OpportunityCard({ opportunity }: { opportunity: OpportunityCardData }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-[280px] shrink-0 cursor-grab flex-col gap-1 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
        isDragging && "z-10 -translate-y-0.5 shadow-md"
      )}
    >
      <Link
        href={`/opportunities/${opportunity.id}`}
        className="text-body font-medium text-neutral-800 hover:underline"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {opportunity.contact_name}
      </Link>
      <span className="text-body-sm text-neutral-500">{opportunity.company_name ?? "—"}</span>
      <span className="text-right text-body-sm text-neutral-700">
        {opportunity.value != null ? currency.format(opportunity.value) : "—"}
      </span>
    </div>
  );
}
