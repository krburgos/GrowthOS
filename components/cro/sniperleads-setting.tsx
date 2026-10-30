"use client";

import { Crosshair } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { monthKey, monthLabel, monthsBetween } from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface SniperLeadsSetting {
  startMonth: string;
  active: boolean;
}

/** Start months offered: the last three years up to this month. */
function startOptions(current: string): string[] {
  const [y, m] = current.split("-").map(Number);
  return monthsBetween(`${y - 3}-${String(m).padStart(2, "0")}-01`, current);
}

/**
 * A client's SniperLeads setting, on its row in Clients (client-confirmed,
 * 2026-10-30, approved mockup "SniperLeads Reports Mockup"). CRO Admin only.
 * On: the client gets a monthly SniperLeads report from its start month,
 * which also sets "Month N". Off keeps its reports but stops new months.
 */
export function SniperLeadsSettingButton({
  accountId,
  accountName,
  setting,
  currentUserId,
}: {
  accountId: string;
  accountName: string;
  setting: SniperLeadsSetting | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const current = monthKey();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(setting?.active ?? true);
  const [start, setStart] = useState(setting?.startMonth ?? current);
  const [pending, setPending] = useState(false);
  const on = !!setting?.active;
  const options = startOptions(current);
  if (!options.includes(start)) options.push(start);

  const handleOpen = (next: boolean) => {
    if (next) {
      setActive(setting?.active ?? true);
      setStart(setting?.startMonth ?? current);
    }
    setOpen(next);
  };

  const handleSave = async () => {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("sniperleads_clients")
      .upsert({ account_id: accountId, start_month: start, active, updated_by: currentUserId }, { onConflict: "account_id" });
    setPending(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(active ? `${accountName} gets a SniperLeads report from ${monthLabel(start)}.` : `SniperLeads reports stopped for ${accountName}.`);
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
            aria-label={`SniperLeads setting for ${accountName}`}
            className={cn(
              "flex size-[30px] items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
              on
                ? "border-secondary-700 bg-secondary-100 text-secondary-800 hover:bg-secondary-50"
                : "border-neutral-300 bg-white text-neutral-400 hover:border-primary-700 hover:text-primary-700"
            )}
          >
            <Crosshair className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {on ? `SniperLeads client since ${monthLabel(setting!.startMonth)}` : "Not a SniperLeads client"}
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SniperLeads: {accountName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label htmlFor={`sl-active-${accountId}`} className="flex items-center gap-2.5 text-body-sm font-medium text-neutral-800">
            <Checkbox id={`sl-active-${accountId}`} checked={active} onCheckedChange={(v) => setActive(v === true)} />
            SniperLeads client
          </label>
          <div>
            <Label htmlFor={`sl-start-${accountId}`}>Started</Label>
            <Select value={start} onValueChange={setStart} disabled={!active}>
              <SelectTrigger id={`sl-start-${accountId}`} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
