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
  win_probability: number;
  owner_name: string | null;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Same hashed-color scheme as the Contacts table's row avatars
 * (components/contacts/contacts-data-table.tsx) — kept as a local
 * copy rather than a shared import, matching this codebase's existing
 * pattern of small per-file initials helpers. */
const AVATAR_COLORS = ["bg-primary-500", "bg-secondary-700", "bg-success-600", "bg-primary-800"];

function ownerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ownerColor(name: string) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Design System §8.4 — Opportunity Kanban Board card. White bg,
 * radius-md, shadow-sm at rest / shadow-md while dragging, 16px
 * padding, 1px neutral-200 border. Cards stay neutral — only column
 * headers carry stage color.
 *
 * Client-confirmed modernization pass (approved mockup): a hover-lift
 * (subtle -translate-y + deeper shadow) so the board reads as
 * interactive even before a drag starts.
 *
 * Impeccable critique finding (2026-09-06, P3): dnd-kit's `attributes`
 * spread already makes this focusable and keyboard-draggable, but with
 * no visible focus state a keyboard user had no way to see which card
 * was focused — `focus-visible:ring` closes that gap with the app's
 * standard ring treatment (§7).
 *
 * Client-confirmed redesign ("Concept B — Value-forward board," Kanban
 * mockup review): adds the owner's initials (hashed color, same scheme
 * as the Contacts table) and the card's stage win-probability (§7.5 of
 * the Backend Schema) as a plain pill — every card in a column shares
 * the same probability since it's a property of the stage, not the
 * individual deal, but repeating it per-card means it's visible without
 * checking the column header.
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
        "flex w-[280px] shrink-0 cursor-grab flex-col gap-1 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 focus-visible:ring-offset-2",
        isDragging && "z-10 -translate-y-0.5 shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/opportunities/${opportunity.id}`}
          className="text-body font-medium text-neutral-800 hover:underline"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {opportunity.contact_name}
        </Link>
        {opportunity.owner_name && (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
              ownerColor(opportunity.owner_name)
            )}
            title={opportunity.owner_name}
          >
            {ownerInitials(opportunity.owner_name)}
          </span>
        )}
      </div>
      <span className="text-body-sm text-neutral-500">{opportunity.company_name ?? "—"}</span>
      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-body-sm font-semibold text-primary-900">
          {opportunity.value != null ? currency.format(opportunity.value) : "—"}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-neutral-600">
          {opportunity.win_probability}%
        </span>
      </div>
    </div>
  );
}
