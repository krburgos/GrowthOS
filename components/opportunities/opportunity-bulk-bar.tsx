"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TypeInput, rememberType } from "@/components/opportunities/type-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chunk } from "@/lib/contacts/bulk-actions";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

const NOBODY = "__nobody__";
/** Ids per request: keeps each update's URL well under PostgREST's limit. */
const BATCH = 150;

type Action = "stage" | "owner" | "type" | "delete";

const noun = (n: number) => `${n.toLocaleString()} ${n === 1 ? "opportunity" : "opportunities"}`;

/**
 * The Opportunities List's bulk bar (client-confirmed, 2026-11-02, approved
 * mockup "Opportunity Bulk Actions"): the floating bar Contacts uses, with
 * Change stage, Salesperson, Type and Delete for every selected
 * opportunity. Moving to a Won or Lost stage asks first and sets each one's
 * closed date (keeping one it already has); an open stage clears it, as the
 * panel does. Delete goes through archive_opportunities(), which allows
 * Owner, Admin and CRO Admin and skips Won opportunities.
 */
export function OpportunityBulkBar({
  ids,
  groupOf,
  totalCount,
  allMatching,
  onSelectAllMatching,
  onClear,
  onDone,
  stages,
  owners,
  accountId,
  canDelete,
}: {
  /** Every selected opportunity, across pages when "Select all" was used. */
  ids: string[];
  /** Stage group of any opportunity in the list, to count Won ones before deleting. */
  groupOf: (id: string) => StageGroup | undefined;
  totalCount: number;
  allMatching: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  /** After a change: the ids it touched, for the saved-row glow. */
  onDone: (ids: string[]) => void;
  stages: { id: string; name: string; stage_group: StageGroup; win_probability: number }[];
  owners: { id: string; full_name: string }[];
  accountId: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [type, setType] = useState("");

  const count = ids.length;
  const stage = stages.find((s) => s.id === stageId);
  const closing = stage && stage.stage_group !== "open";
  const won = ids.filter((id) => groupOf(id) === "won").length;
  const toDelete = count - won;

  const show = (a: Action) => {
    setStageId("");
    setOwnerId("");
    setType("");
    setOpen(a);
  };

  /** Runs one update over every selected id, a batch at a time. */
  const updateAll = async (values: Record<string, unknown>, onlyOpenClosedAt = false) => {
    const supabase = createClient();
    for (const part of chunk(ids, BATCH)) {
      let q = supabase.from("opportunities").update(values).in("id", part);
      if (onlyOpenClosedAt) q = q.is("closed_at", null);
      const { error } = await q;
      if (error) return error;
    }
    return null;
  };

  const finish = (message: string) => {
    toast.success(message);
    setOpen(null);
    onDone(ids);
  };

  const applyStage = async () => {
    if (!stage) return;
    setBusy(true);
    let error = await updateAll({ stage_id: stage.id });
    // Won or Lost keeps the day it first closed; reopening clears it.
    if (!error) error = closing ? await updateAll({ closed_at: new Date().toISOString() }, true) : await updateAll({ closed_at: null });
    setBusy(false);
    if (error) return toast.error(getFriendlyErrorMessage(error));
    finish(`${noun(count)} moved to ${stage.name}.`);
  };

  const applyOwner = async () => {
    if (!ownerId) return;
    setBusy(true);
    const error = await updateAll({ owner_id: ownerId === NOBODY ? null : ownerId });
    setBusy(false);
    if (error) return toast.error(getFriendlyErrorMessage(error));
    const name = ownerId === NOBODY ? "nobody yet" : owners.find((o) => o.id === ownerId)?.full_name;
    finish(`${noun(count)} updated: salesperson is ${name}.`);
  };

  const applyType = async () => {
    setBusy(true);
    const value = type.trim();
    const error = await updateAll({ type: value || null });
    setBusy(false);
    if (error) return toast.error(getFriendlyErrorMessage(error));
    rememberType(accountId, value);
    finish(`${noun(count)} updated: type ${value ? `is ${value}` : "cleared"}.`);
  };

  const applyDelete = async () => {
    setBusy(true);
    const supabase = createClient();
    let deleted = 0;
    let skipped = 0;
    for (const part of chunk(ids, BATCH)) {
      const { data, error } = await supabase.rpc("archive_opportunities", { p_ids: part });
      if (error) {
        setBusy(false);
        return toast.error(getFriendlyErrorMessage(error));
      }
      const r = data as { deleted: number; skipped_won: number };
      deleted += r.deleted;
      skipped += r.skipped_won;
    }
    setBusy(false);
    finish(`${noun(deleted)} deleted${skipped ? `, ${skipped} Won skipped` : ""}.`);
  };

  const action = "h-8 gap-1.5 px-2.5 text-body-sm text-white hover:bg-white/20 hover:text-white active:bg-white/30";
  const selectedLine = <DialogDescription>{noun(count)} selected</DialogDescription>;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <div
          role="region"
          aria-label="Bulk actions"
          className="pointer-events-auto flex w-full max-w-[920px] flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] px-3 py-2 shadow-[0_20px_40px_-16px_rgba(2,20,50,0.6)]"
        >
          <span className="mr-1 text-body-sm font-semibold tabular-nums text-white">{count.toLocaleString()} selected</span>
          {!allMatching && totalCount > count && (
            <button type="button" onClick={onSelectAllMatching} className="mr-2 text-body-sm font-semibold text-secondary-300 hover:underline">
              Select all {totalCount.toLocaleString()}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" onClick={() => show("stage")} className={action}>
              Change stage
            </Button>
            <Button type="button" variant="ghost" onClick={() => show("owner")} className={action}>
              Salesperson
            </Button>
            <Button type="button" variant="ghost" onClick={() => show("type")} className={action}>
              Type
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => show("delete")}
                aria-label="Delete selected opportunities"
                className="h-8 gap-1.5 px-2.5 text-body-sm text-error-300 hover:bg-error-400/20 hover:text-error-200"
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="ml-auto flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <Dialog open={open === "stage"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change stage</DialogTitle>
            {selectedLine}
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-stage">New stage</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger id="bulk-stage">
                <SelectValue placeholder="Choose a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span>{s.name}</span>
                      <span className="text-caption tabular-nums text-neutral-400">{s.win_probability}%</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {closing && (
            <p className="mt-3 rounded-md bg-secondary-50 px-3 py-2 text-body-sm text-secondary-800">
              This closes them as {stage.stage_group === "won" ? "Won" : "Lost"}: each gets today&apos;s closed date (or keeps the one it
              has){stage.stage_group === "won" ? ", and they count toward Closed-Won revenue" : ""}.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant={closing && stage.stage_group === "lost" ? "destructive" : "primary"}
              onClick={() => void applyStage()}
              disabled={!stage || busy}
            >
              {busy
                ? "Saving…"
                : closing
                  ? `Mark ${noun(count)} as ${stage.stage_group === "won" ? "Won" : "Lost"}`
                  : `Move ${noun(count)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "owner"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change salesperson</DialogTitle>
            {selectedLine}
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-owner">Salesperson</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="bulk-owner">
                <SelectValue placeholder="Choose a salesperson" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                {owners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => void applyOwner()} disabled={!ownerId || busy}>
              {busy ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "type"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change type</DialogTitle>
            {selectedLine}
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <TypeInput accountId={accountId} value={type} onChange={setType} />
            <p className="text-caption text-neutral-500">Suggests the types already used. Leave it empty to clear the type.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => void applyType()} disabled={busy}>
              {busy ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "delete"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {noun(toDelete)}?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">
            They&apos;ll be removed from the board, lists, reports and every page, but kept on record.
          </p>
          {won > 0 && (
            <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-body-sm text-neutral-700">
              {won} Won {won === 1 ? "opportunity is" : "opportunities are"} skipped: they count toward Closed-Won revenue.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void applyDelete()} disabled={toDelete === 0 || busy}>
              {busy ? "Deleting…" : `Delete ${noun(toDelete)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
