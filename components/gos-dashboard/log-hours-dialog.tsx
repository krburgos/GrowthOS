"use client";

import { ExternalLink, House } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMockup } from "@/components/gos-dashboard/mockup-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { quarterPct, paceTone, type StepHours } from "@/lib/gos-dashboard/hours-mockup";
import { cn } from "@/lib/utils";

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

export function OutsourcedChip({ outsourced }: { outsourced: boolean }) {
  return outsourced ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-0.5 text-caption font-semibold text-primary-700">
      <ExternalLink className="size-3" />
      Outsourced
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-0.5 text-caption font-semibold text-neutral-500">
      <House className="size-3" />
      In-house
    </span>
  );
}

function HoursInput({ id, label, suffix, value, onChange }: { id: string; label: string; suffix: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
        <input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-9 min-w-0 flex-1 px-3 text-body tabular-nums text-neutral-800 focus:outline-none"
        />
        <span className="flex items-center border-l border-neutral-200 bg-neutral-50 px-3 text-body-sm text-neutral-400">{suffix}</span>
      </div>
    </div>
  );
}

export function LogHoursDialog({
  slug,
  title,
  open,
  onOpenChange,
}: {
  slug: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { hours, setHours, quarter } = useMockup();
  const [draft, setDraft] = useState<StepHours>(hours[slug]);

  useEffect(() => {
    if (open) setDraft(hours[slug]);
  }, [open, hours, slug]);

  const save = () => {
    setHours(slug, draft);
    toast.success(`Hours saved for ${title}.`);
    onOpenChange(false);
  };

  const pct = quarterPct(draft);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log hours — {title}</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            {quarter.label} · editable by MSP Owner/Admin and CRO Admin/Advisor
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <HoursInput id="hours-needed" label="Hours needed to complete" suffix="hrs total" value={draft.needed} onChange={(n) => setDraft({ ...draft, needed: n })} />
            <p className="mt-1 text-caption text-neutral-400">Total for the whole {title} workstream, across quarters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HoursInput id="hours-committed" label="Committed this quarter" suffix="hrs" value={draft.committed} onChange={(n) => setDraft({ ...draft, committed: n })} />
            <HoursInput id="hours-achieved" label="Achieved this quarter" suffix="hrs" value={draft.achieved} onChange={(n) => setDraft({ ...draft, achieved: n })} />
          </div>

          <div className="rounded-md bg-neutral-50 px-3 py-2.5">
            <div className="mb-2 flex justify-between text-caption text-neutral-500">
              <span>
                Card will show <b className="tabular-nums text-primary-900">{draft.achieved} / {draft.committed} hrs</b>
              </span>
              <span className="tabular-nums">{pct}% of commitment</span>
            </div>
            <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
          </div>

          <div>
            <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">Outsourced</span>
            <div className="inline-flex overflow-hidden rounded-md border border-neutral-300" role="group" aria-label="Outsourced">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={draft.outsourced === v}
                  onClick={() => setDraft({ ...draft, outsourced: v })}
                  className={cn(
                    "px-5 py-2 text-body-sm font-semibold",
                    !v && "border-l border-neutral-300",
                    draft.outsourced === v ? "bg-primary-100 text-primary-700" : "bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save hours</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
