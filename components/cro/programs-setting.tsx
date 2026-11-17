"use client";

import { Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { PROGRAMS, PROGRAM_LABEL, type Program, type ProgramSetting } from "@/lib/programs/programs";
import { monthKey, monthLabel, monthsBetween } from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Start months offered: the last three years up to this month. */
function startOptions(current: string): string[] {
  const [y, m] = current.split("-").map(Number);
  return monthsBetween(`${y - 3}-${String(m).padStart(2, "0")}-01`, current);
}

type Draft = Record<Program, { on: boolean; start: string }>;

/**
 * A client's CRO Leader programs, on its row in Clients (client-confirmed
 * 2026-11-16, approved mockup "Program Reports Mockup"; replaces the
 * 2026-10-30 SniperLeads setting). CRO Admin only. Each program switched on
 * gets a monthly report from its start month and its own tab in the
 * client's Intel. Off hides the tab and stops new months; past reports are
 * kept.
 */
export function ProgramsSettingButton({
  accountId,
  accountName,
  settings,
  currentUserId,
}: {
  accountId: string;
  accountName: string;
  settings: ProgramSetting[];
  currentUserId: string;
}) {
  const router = useRouter();
  const current = monthKey();
  const fresh = (): Draft =>
    Object.fromEntries(
      PROGRAMS.map((p) => {
        const s = settings.find((x) => x.program === p);
        return [p, { on: !!s?.active, start: s?.startMonth ?? current }];
      })
    ) as Draft;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(fresh);
  const [pending, setPending] = useState(false);
  const live = settings.filter((s) => s.active);

  const handleOpen = (next: boolean) => {
    if (next) setDraft(fresh());
    setOpen(next);
  };

  const handleSave = async () => {
    // Write programs switched on, and existing rows switched off; a program
    // never switched on gets no row at all.
    const rows = PROGRAMS.filter((p) => draft[p].on || settings.some((s) => s.program === p)).map((p) => ({
      account_id: accountId,
      program: p,
      start_month: draft[p].start,
      active: draft[p].on,
      updated_by: currentUserId,
    }));
    if (rows.length === 0) {
      setOpen(false);
      return;
    }
    setPending(true);
    const { error } = await createClient().from("account_programs").upsert(rows, { onConflict: "account_id,program" });
    setPending(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Programs saved for ${accountName}.`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleOpen(true)}
            aria-label={`Programs for ${accountName}`}
            className={cn(
              "flex size-[30px] items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
              live.length > 0
                ? "border-secondary-700 bg-secondary-100 text-secondary-800 hover:bg-secondary-50"
                : "border-neutral-300 bg-white text-neutral-400 hover:border-primary-700 hover:text-primary-700"
            )}
          >
            <Layers className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {live.length > 0 ? live.map((s) => `${PROGRAM_LABEL[s.program]} since ${monthLabel(s.startMonth)}`).join(" · ") : "No programs"}
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programs: {accountName}</DialogTitle>
          <DialogDescription>Each program switched on gets its own tab in the client&apos;s Intel. Switching one off keeps its past reports.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {PROGRAMS.map((p) => {
            const options = startOptions(current);
            if (!options.includes(draft[p].start)) options.push(draft[p].start);
            return (
              <div key={p} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <label htmlFor={`prog-${p}-${accountId}`} className="flex min-w-36 flex-1 items-center gap-2.5 text-body-sm font-medium text-neutral-800">
                  <Checkbox
                    id={`prog-${p}-${accountId}`}
                    checked={draft[p].on}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, [p]: { ...d[p], on: v === true } }))}
                  />
                  {PROGRAM_LABEL[p]}
                </label>
                <Select value={draft[p].start} onValueChange={(v) => setDraft((d) => ({ ...d, [p]: { ...d[p], start: v } }))} disabled={!draft[p].on}>
                  <SelectTrigger aria-label={`${PROGRAM_LABEL[p]} since`} className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((m) => (
                      <SelectItem key={m} value={m}>
                        Since {monthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
