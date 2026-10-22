"use client";

import { Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { DailyTarget } from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";

/**
 * One SDR's daily target, set by CRO Leader (client-confirmed, 2026-10-22).
 * Saved per SDR per account; an SDR with no row uses DEFAULT_TARGET.
 */
export function SdrTargetEditor({
  accountId,
  sdrId,
  sdrName,
  target,
  onSaved,
}: {
  accountId: string;
  sdrId: string;
  sdrName: string;
  target: DailyTarget;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState(String(target.calls));
  const [meetings, setMeetings] = useState(String(target.meetings));
  const [saving, setSaving] = useState(false);

  const c = Number(calls);
  const m = Number(meetings);
  const valid = calls !== "" && meetings !== "" && Number.isInteger(c) && Number.isInteger(m) && c >= 0 && c <= 1000 && m >= 0 && m <= 100;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("sdr_daily_targets")
      .upsert(
        { account_id: accountId, sdr_user_id: sdrId, calls: c, meetings: m, updated_by: user?.id ?? null, archived_at: null },
        { onConflict: "account_id,sdr_user_id" }
      );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Daily target saved for ${sdrName}.`);
    setOpen(false);
    onSaved();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center whitespace-nowrap rounded-md border border-white/30 bg-white/10 px-3 text-button text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
        >
          <Target className="mr-1.5 size-4" />
          Set target
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-body-sm font-semibold text-primary-900">Daily target for {sdrName}</p>
        <p className="mb-3 text-caption text-neutral-500">Counted on the Call Desk and the scoreboard.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Calls</span>
            <Input type="number" inputMode="numeric" min={0} max={1000} step={1} value={calls} onChange={(e) => setCalls(e.target.value)} className="h-9 tabular-nums" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Meetings</span>
            <Input type="number" inputMode="numeric" min={0} max={100} step={1} value={meetings} onChange={(e) => setMeetings(e.target.value)} className="h-9 tabular-nums" />
          </label>
        </div>
        {!valid && <p className="mt-2 text-caption text-error-700">Use whole numbers: up to 1,000 calls and 100 meetings.</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
