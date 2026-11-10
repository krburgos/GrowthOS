"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/growth-mission/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { STATUS_LABEL, type KpiStat, type PlaybookStatus } from "@/lib/growth-mission/playbook";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS: PlaybookStatus[] = ["on_track", "ahead", "needs_attention"];

/**
 * A Mission Card's status and headline figure, top right of the card.
 *
 * Client-confirmed (2026-11-10, approved mockup "Mission Card Edit
 * Mockup", UX audit item 6): everyone sees the same read-out, the headline
 * figure with its label and the status. CRO Admin and CRO Advisor get
 * **Edit card**, a side panel (Edit Opportunity's pattern) with Status,
 * Headline label, Headline value and a preview; it saves straight to
 * growth_mission_step_status. Until then they saw the form itself in the
 * header, and other viewers saw only the status.
 */
export function EditOverviewPanel({
  accountId,
  stepSlug,
  stepTitle,
  initialStatus,
  initialHeadline,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  stepTitle: string;
  initialStatus: PlaybookStatus;
  initialHeadline: KpiStat | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  // What the header shows: the saved values.
  const [saved, setSaved] = useState({
    status: initialStatus,
    label: initialHeadline?.label ?? "",
    value: initialHeadline?.value ?? "",
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);

  const openPanel = () => {
    setDraft(saved);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await createClient()
      .from("growth_mission_step_status")
      .upsert(
        {
          account_id: accountId,
          step_slug: stepSlug,
          status: draft.status,
          headline_label: draft.label.trim() || null,
          headline_value: draft.value.trim() || null,
        },
        { onConflict: "account_id,step_slug" }
      );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setSaved({ status: draft.status, label: draft.label.trim(), value: draft.value.trim() });
    setOpen(false);
    toast.success("Card updated.");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ReadOut status={saved.status} label={saved.label} value={saved.value} />
      {canEdit && (
        <Button type="button" variant="secondary" onClick={openPanel} className="gap-1.5">
          <Pencil className="size-4" />
          Edit card
        </Button>
      )}

      {canEdit && (
        <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
          <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[420px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
            <DialogHeader className="mb-0 px-6 pb-4 pt-6">
              <p className="text-caption font-semibold uppercase tracking-wide text-secondary-700">Edit card</p>
              <DialogTitle>{stepTitle}</DialogTitle>
              <DialogDescription className="text-body-sm text-neutral-500">What everyone sees at the top of this card.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto border-t border-neutral-100 px-6 py-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-body-sm text-neutral-500">Status</span>
                <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as PlaybookStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-body-sm text-neutral-500">Headline label</span>
                  <Input
                    value={draft.label}
                    placeholder="Calls / day"
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-body-sm text-neutral-500">Headline value</span>
                  <Input
                    value={draft.value}
                    placeholder="58"
                    onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                  />
                </label>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Preview</p>
                <div className="mt-2 flex justify-end">
                  <ReadOut status={draft.status} label={draft.label.trim()} value={draft.value.trim()} />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-0 justify-end gap-3 border-t border-neutral-100 px-6 py-4">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** The headline figure (only when one is set) and the status pill. */
function ReadOut({ status, label, value }: { status: PlaybookStatus; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      {value && (
        <div className="flex flex-col items-end">
          <span className="text-h3 font-bold tabular-nums text-primary-900">{value}</span>
          {label && <span className="text-caption text-neutral-500">{label}</span>}
        </div>
      )}
      <StatusBadge status={status} />
    </div>
  );
}
