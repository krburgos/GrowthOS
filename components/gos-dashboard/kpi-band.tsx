"use client";

import { ArrowRight, KanbanSquare, Plus, Radio, SlidersHorizontal, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMockup } from "@/components/gos-dashboard/mockup-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_MAPPING,
  KPI_BOXES,
  KPI_SOURCES,
  SOURCE_BY_ID,
  sampleRecords,
  type KpiBox,
  type KpiBoxKey,
} from "@/lib/gos-dashboard/hours-mockup";
import { cn } from "@/lib/utils";

function boxCount(ids: string[]) {
  return ids.reduce((sum, id) => sum + (SOURCE_BY_ID.get(id)?.count ?? 0), 0);
}

function RecordsDialog({ box, onClose }: { box: KpiBox | null; onClose: () => void }) {
  const { mapping } = useMockup();
  if (!box) return null;
  const ids = mapping[box.key];
  const total = boxCount(ids);
  const rows = sampleRecords(ids);
  const isContacts = ids.every((id) => SOURCE_BY_ID.get(id)?.kind === "contact_status");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {box.label} <span className="tabular-nums text-neutral-400">· {total.toLocaleString()}</span>
          </DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            {ids.length === 0 ? "Nothing mapped to this box yet." : `Counting ${ids.map((id) => SOURCE_BY_ID.get(id)?.name).join(", ")}`}
          </DialogDescription>
        </DialogHeader>

        {rows.length > 0 ? (
          <ul className="max-h-[340px] divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-neutral-800">{r.name}</p>
                  <p className="truncate text-caption text-neutral-500">
                    {isContacts ? r.company : r.detail}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary-50 px-2 py-0.5 text-caption font-medium text-secondary-800">
                  {r.source}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-neutral-50 p-4 text-body-sm text-neutral-500">No records to show.</p>
        )}
        {total > rows.length && (
          <p className="mt-2 text-caption text-neutral-400">
            Showing {rows.length} of {total.toLocaleString()} sample records.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button asChild>
            <Link href={isContacts ? "/contacts" : "/opportunities"}>
              Open in {isContacts ? "Contacts" : "Opportunities"}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { mapping, setMapping } = useMockup();
  const [draft, setDraft] = useState(mapping);

  useEffect(() => {
    if (open) setDraft(mapping);
  }, [open, mapping]);

  const assigned = new Set(Object.values(draft).flat());
  const remove = (key: KpiBoxKey, id: string) => setDraft({ ...draft, [key]: draft[key].filter((x) => x !== id) });
  const add = (key: KpiBoxKey, id: string) => setDraft({ ...draft, [key]: [...draft[key], id] });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-32px)] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KPI mapping</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            Which contact statuses and opportunity stages each box counts for this account. CRO Admin only.
          </DialogDescription>
        </DialogHeader>

        <p className="mb-3 rounded-md bg-neutral-50 px-3 py-2 text-caption text-neutral-500">
          Pre-filled by matching names. <span className="font-semibold text-primary-700">Navy</span> chips are contact
          statuses, <span className="font-semibold text-secondary-800">teal</span> chips are opportunity stages. Each
          status or stage counts toward one box at most.
        </p>

        <div className="divide-y divide-neutral-100">
          {KPI_BOXES.map((box) => {
            const available = KPI_SOURCES.filter((s) => !assigned.has(s.id));
            return (
              <div key={box.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <div className="w-32 shrink-0">
                  <p className="text-body-sm font-semibold text-primary-900">{box.label}</p>
                  <p className="text-caption tabular-nums text-neutral-400">{boxCount(draft[box.key]).toLocaleString()} counted</p>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {draft[box.key].map((id) => {
                    const src = SOURCE_BY_ID.get(id)!;
                    return (
                      <span
                        key={id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-caption font-medium",
                          src.kind === "contact_status"
                            ? "border-primary-100 bg-primary-50 text-primary-700"
                            : "border-secondary-100 bg-secondary-50 text-secondary-800"
                        )}
                      >
                        {src.name}
                        <button
                          type="button"
                          aria-label={`Remove ${src.name}`}
                          onClick={() => remove(box.key, id)}
                          className="rounded-full p-0.5 hover:bg-white"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                  <Select value="" onValueChange={(id) => add(box.key, id)}>
                    <SelectTrigger
                      className="h-7 w-auto gap-1 rounded-full border-dashed px-2.5 text-caption font-semibold text-neutral-500"
                      aria-label={`Add to ${box.label}`}
                    >
                      <Plus className="size-3" />
                      <SelectValue placeholder="Add" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.length === 0 && <div className="px-2 py-1.5 text-caption text-neutral-400">Everything is mapped</div>}
                      {available.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.kind === "contact_status" ? "status" : "stage"} ({s.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_MAPPING)}>
            Reset to defaults
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setMapping(draft);
                toast.success("KPI mapping saved.");
                onOpenChange(false);
              }}
            >
              Save mapping
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Playbook doc's "GrowthOS KPI dashboard": Prospects + Opportunities in Pipeline, counted live from the CRM (sample counts in this mockup). */
export function KpiBand({ canEditMapping }: { canEditMapping: boolean }) {
  const { mapping } = useMockup();
  const [openBox, setOpenBox] = useState<KpiBox | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const renderCell = (box: KpiBox, i: number) => {
    const ids = mapping[box.key];
    const names = ids.map((id) => SOURCE_BY_ID.get(id)?.name).filter(Boolean);
    return (
      <button
        key={box.key}
        type="button"
        onClick={() => setOpenBox(box)}
        className={cn(
          "flex flex-col items-center gap-0.5 border-t border-neutral-100 px-2 pb-3.5 pt-3 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500",
          i > 0 && "border-l"
        )}
      >
        <span className="text-caption font-semibold text-neutral-500">{box.label}</span>
        <span
          className={cn(
            "text-h2 font-bold leading-tight tabular-nums",
            box.tone === "won" ? "text-success-700" : box.tone === "lost" ? "text-neutral-500" : box.tone === "ghosted" ? "text-warning-800" : "text-primary-900"
          )}
        >
          {boxCount(ids).toLocaleString()}
        </span>
        <span className="line-clamp-1 text-center text-[10.5px] text-neutral-400">{names.length ? names.join(" + ") : "Not mapped"}</span>
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body-sm font-semibold text-neutral-600">GrowthOS KPI Dashboard</h2>
        <div className="flex items-center gap-3 text-caption text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Radio className="size-3.5" />
            Live from your CRM
          </span>
          {canEditMapping && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-secondary-700 hover:underline"
            >
              <SlidersHorizontal className="size-3.5" />
              Edit mapping
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid-cols-[2fr_6fr]">
        <div>
          <div className="flex items-center justify-center gap-1.5 bg-primary-900 px-3 py-2 text-body-sm font-semibold text-white">
            <Users className="size-3.5" />
            Prospects
          </div>
          <div className="grid grid-cols-2">{KPI_BOXES.filter((b) => b.group === "prospects").map(renderCell)}</div>
        </div>
        <div className="border-t border-neutral-200 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-center gap-1.5 bg-secondary-700 px-3 py-2 text-body-sm font-semibold text-white">
            <KanbanSquare className="size-3.5" />
            Opportunities in Pipeline
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6">{KPI_BOXES.filter((b) => b.group === "pipeline").map(renderCell)}</div>
        </div>
      </div>

      <RecordsDialog box={openBox} onClose={() => setOpenBox(null)} />
      <MappingDialog open={mapOpen} onOpenChange={setMapOpen} />
    </section>
  );
}
