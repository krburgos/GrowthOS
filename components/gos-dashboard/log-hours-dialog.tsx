"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HoursBar } from "@/components/gos-dashboard/hours-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { formatHours, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function HoursInput({
  id,
  label,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-0 flex-1 px-3 text-body tabular-nums text-neutral-800 focus:outline-none"
        />
        <span className="flex items-center border-l border-neutral-200 bg-neutral-50 px-3 text-body-sm text-neutral-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}

const toNum = (v: string) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);

/**
 * Writes straight to gos_dashboard_step_hours (needed, outsourced) and
 * gos_dashboard_quarter_hours (this quarter's committed/achieved) under
 * RLS — MSP Owner/Admin for their own account, CRO Admin/Advisor for any.
 */
export function LogHoursDialog({
  accountId,
  slug,
  title,
  hours,
  quarter,
  open,
  onOpenChange,
}: {
  accountId: string;
  slug: string;
  title: string;
  hours: StepHours;
  quarter: QuarterInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [needed, setNeeded] = useState("");
  const [committed, setCommitted] = useState("");
  const [achieved, setAchieved] = useState("");
  const [outsourced, setOutsourced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNeeded(String(hours.needed));
    setCommitted(String(hours.committed));
    setAchieved(String(hours.achieved));
    setOutsourced(hours.outsourced);
  }, [open, hours]);

  const pct = quarterPct({ committed: toNum(committed), achieved: toNum(achieved) });

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [stepRes, quarterRes] = await Promise.all([
      supabase
        .from("gos_dashboard_step_hours")
        .upsert(
          { account_id: accountId, step_slug: slug, needed_hours: toNum(needed), outsourced, updated_by: user?.id ?? null },
          { onConflict: "account_id,step_slug" }
        ),
      supabase.from("gos_dashboard_quarter_hours").upsert(
        {
          account_id: accountId,
          step_slug: slug,
          quarter_start: quarter.start,
          committed_hours: toNum(committed),
          achieved_hours: toNum(achieved),
          updated_by: user?.id ?? null,
        },
        { onConflict: "account_id,step_slug,quarter_start" }
      ),
    ]);
    setSaving(false);
    const error = stepRes.error ?? quarterRes.error;
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Hours saved for ${title}.`);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log hours — {title}</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            {quarter.label} · {quarter.range}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <HoursInput id={`needed-${slug}`} label="Hours needed to complete" suffix="hrs total" value={needed} onChange={setNeeded} />
            <p className="mt-1 text-caption text-neutral-400">Total for the whole {title} workstream, across quarters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HoursInput id={`committed-${slug}`} label="Committed this quarter" suffix="hrs" value={committed} onChange={setCommitted} />
            <HoursInput id={`achieved-${slug}`} label="Achieved this quarter" suffix="hrs" value={achieved} onChange={setAchieved} />
          </div>

          <div className="rounded-md bg-neutral-50 px-3 py-2.5">
            <div className="mb-2 flex flex-wrap justify-between gap-1 text-caption text-neutral-500">
              <span>
                Card will show{" "}
                <b className="tabular-nums text-primary-900">
                  {formatHours(toNum(achieved))} of {formatHours(toNum(committed))} hrs
                </b>
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
                  aria-pressed={outsourced === v}
                  onClick={() => setOutsourced(v)}
                  className={cn(
                    "px-5 py-2 text-body-sm font-semibold",
                    !v && "border-l border-neutral-300",
                    outsourced === v
                      ? v
                        ? "bg-success-100 text-success-700"
                        : "bg-error-100 text-error-700"
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
