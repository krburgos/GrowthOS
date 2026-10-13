"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { CREDITS_PER_HOUR, type MissionCapacity } from "@/lib/growth-mission/capacity";
import { formatWhole } from "@/lib/growth-mission/hours";
import { createClient } from "@/lib/supabase/client";

/**
 * CRO Leader sets an account's monthly credit allotment (client-confirmed,
 * 2026-10-13). Typed by hand until subscription tiers supply the figure.
 *
 * Saving writes the allotment for the current month; the app adds it on
 * the 1st of every month after that and rolls unused credits over, so this
 * is typed once rather than kept up to date. Earlier months keep the
 * allotment they had (see account_credit_allotments).
 */
export function CreditsDialog({
  accountId,
  capacity,
  open,
  onOpenChange,
}: {
  accountId: string;
  capacity: MissionCapacity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(capacity.credits.monthly != null ? String(capacity.credits.monthly) : "");
  }, [open, capacity.credits.monthly]);

  const save = async () => {
    const monthly = Math.max(0, Math.round(Number(value) || 0));
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const now = new Date();
    const effectiveMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const { error } = await supabase
      .from("account_credit_allotments")
      .upsert(
        { account_id: accountId, effective_month: effectiveMonth, monthly_credits: monthly, updated_by: user?.id ?? null },
        { onConflict: "account_id,effective_month" }
      );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Credits saved.");
    onOpenChange(false);
    router.refresh();
  };

  const rows = [
    {
      label: `Used this quarter (${formatWhole(capacity.hours.completed)} hrs × ${CREDITS_PER_HOUR})`,
      value: formatWhole(capacity.credits.used),
    },
    {
      label: "Credits available now",
      value: capacity.credits.available != null ? formatWhole(capacity.credits.available) : "Not set",
      total: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Set credits</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            Typed in by CRO Leader for now, until credits come from the subscription tier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="monthly-credits">Monthly credit allotment</Label>
            <div className="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-500/40">
              <input
                id="monthly-credits"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 min-w-0 flex-1 px-3 text-body tabular-nums text-neutral-800 focus:outline-none"
              />
              <span className="flex items-center border-l border-neutral-200 bg-neutral-50 px-3 text-body-sm text-neutral-400">
                credits / month
              </span>
            </div>
            <p className="mt-1.5 text-caption text-neutral-500">
              Added on the 1st of each month. Unused credits roll over. {CREDITS_PER_HOUR} credits = 1 hour.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md bg-neutral-50 px-3.5 py-3 text-body-sm">
            {rows.map((r) => (
              <div
                key={r.label}
                className={`flex justify-between gap-3 ${r.total ? "border-t border-neutral-200 pt-1.5 font-semibold text-primary-900" : "text-neutral-600"}`}
              >
                <span>{r.label}</span>
                <span className="font-semibold tabular-nums text-neutral-800">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || value.trim() === ""}>
            {saving ? "Saving…" : "Save credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
