"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface RecipientRow {
  id: string;
  contactName: string;
  contactEmail: string;
  status: "pending" | "sent" | "failed" | "bounced" | "unsubscribed";
  openedAt: string | null;
  clickedAt: string | null;
  sentAt: string | null;
}

const STATUS_BADGE: Record<RecipientRow["status"], "neutral" | "success" | "error"> = {
  pending: "neutral",
  sent: "success",
  failed: "error",
  bounced: "error",
  unsubscribed: "neutral",
};

type Filter = "all" | "opened" | "clicked" | "bounced" | "unsubscribed";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Client-confirmed (approved mockup, 2026-09-08) — Campaign Detail's recipient list. */
export function CampaignRecipientsTable({ recipients }: { recipients: RecipientRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    all: recipients.length,
    opened: recipients.filter((r) => r.openedAt).length,
    clicked: recipients.filter((r) => r.clickedAt).length,
    bounced: recipients.filter((r) => r.status === "bounced").length,
    unsubscribed: recipients.filter((r) => r.status === "unsubscribed").length,
  };

  const filtered = recipients.filter((r) => {
    if (filter === "all") return true;
    if (filter === "opened") return !!r.openedAt;
    if (filter === "clicked") return !!r.clickedAt;
    if (filter === "bounced") return r.status === "bounced";
    if (filter === "unsubscribed") return r.status === "unsubscribed";
    return true;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "opened", label: "Opened" },
    { value: "clicked", label: "Clicked" },
    { value: "bounced", label: "Bounced" },
    { value: "unsubscribed", label: "Unsubscribed" },
  ];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">Recipients</h2>
        <span className="text-caption text-neutral-500">{recipients.length} total</span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3.5">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-caption font-medium transition-colors",
              filter === f.value
                ? "border-primary-800 bg-primary-800 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-primary-700 hover:text-primary-800"
            )}
          >
            {f.label} <span className="opacity-70">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-neutral-500">No recipients match this filter.</p>
      ) : (
        <div className="mt-3 max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Clicked</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-caption font-semibold text-white">
                        {initials(r.contactName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-800">{r.contactName}</p>
                        <p className="truncate text-caption text-neutral-400">{r.contactEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                  </TableCell>
                  <TableCell className="text-neutral-500">{r.openedAt ? timeLabel(r.openedAt) : "—"}</TableCell>
                  <TableCell className="text-neutral-500">{r.clickedAt ? timeLabel(r.clickedAt) : "—"}</TableCell>
                  <TableCell className="text-neutral-500">{r.sentAt ? timeLabel(r.sentAt) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
