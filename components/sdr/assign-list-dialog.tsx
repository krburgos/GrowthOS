"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { Assignment, SdrPerson } from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Give a list to an SDR (client-confirmed, 2026-10-22: CRO Admin only).
 * A list belongs to one SDR at a time, so giving a held list to someone
 * else moves it; the call history stays on each contact.
 */
export function AssignListDialog({
  accountId,
  lists,
  assignments,
  people,
  initialSdrId,
  onClose,
  onAssigned,
}: {
  accountId: string;
  lists: { id: string; name: string; contacts: number }[];
  assignments: Assignment[];
  people: SdrPerson[];
  initialSdrId: string | null;
  onClose: () => void;
  onAssigned: (sdrId: string) => void;
}) {
  const [listId, setListId] = useState<string | null>(null);
  const [sdrId, setSdrId] = useState(initialSdrId ?? people[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name ?? "Someone";
  const holder = listId ? assignments.find((a) => a.list_id === listId) : undefined;
  const list = lists.find((l) => l.id === listId);
  const canSave = !!listId && !!sdrId && holder?.sdr_user_id !== sdrId;

  const assign = async () => {
    if (!canSave || !listId) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = holder
      ? await supabase.from("sdr_list_assignments").update({ sdr_user_id: sdrId, assigned_by: user?.id ?? null }).eq("id", holder.id)
      : await supabase
          .from("sdr_list_assignments")
          .insert({ account_id: accountId, list_id: listId, sdr_user_id: sdrId, assigned_by: user?.id ?? null });
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${list?.name ?? "List"} assigned to ${nameOf(sdrId)}.`);
    onAssigned(sdrId);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign a list</DialogTitle>
          <DialogDescription>Its contacts go into the SDR&apos;s Call Queue.</DialogDescription>
        </DialogHeader>

        {people.length === 0 ? (
          <p className="text-body-sm text-neutral-600">
            There&apos;s nobody to assign to yet. SDRs are this account&apos;s Marketing users and the Partners granted
            to it; invite one first.
          </p>
        ) : lists.length === 0 ? (
          <p className="text-body-sm text-neutral-600">This account has no lists yet. Build one on the Lists page first.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">List</legend>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {lists.map((l) => {
                  const on = l.id === listId;
                  const held = assignments.find((a) => a.list_id === l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setListId(l.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
                        on ? "border-primary-700 bg-primary-50" : "border-neutral-200 hover:border-primary-700"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-primary-700 bg-primary-700 text-white" : "border-neutral-300"
                        )}
                      >
                        {on && <Check className="size-2.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold text-neutral-900">{l.name}</span>
                        <span className="block text-caption tabular-nums text-neutral-500">
                          {l.contacts.toLocaleString()} {l.contacts === 1 ? "contact" : "contacts"}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-caption", held ? "font-semibold text-primary-700" : "text-neutral-400")}>
                        {held ? nameOf(held.sdr_user_id) : "Not assigned"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">SDR</span>
              <Select value={sdrId} onValueChange={setSdrId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an SDR" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {p.role === "partner" ? " (Partner)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-caption text-neutral-500">SDRs are this account&apos;s Marketing users and its Partners.</span>
            </div>

            {holder && holder.sdr_user_id !== sdrId && (
              <p className="rounded-md border border-warning-300 bg-warning-100 px-3 py-2 text-body-sm text-warning-900">
                {list?.name} is in {nameOf(holder.sdr_user_id)}&apos;s queue now. Assigning it moves it to {nameOf(sdrId)};
                the call history stays on each contact.
              </p>
            )}
            {holder && holder.sdr_user_id === sdrId && (
              <p className="text-body-sm text-neutral-500">Already in {nameOf(sdrId)}&apos;s queue.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || saving} onClick={assign}>
            {saving ? "Assigning…" : list ? `Assign ${list.contacts.toLocaleString()} ${list.contacts === 1 ? "contact" : "contacts"}` : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
