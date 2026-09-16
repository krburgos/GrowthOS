"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { STATUS_LABEL, type KpiStat, type PlaybookStatus } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS: PlaybookStatus[] = ["on_track", "ahead", "needs_attention"];

/**
 * CRO Leader (cro_admin/cro_advisor) edit surface for a step's status pill
 * and headline stat (Task 5). Read-only viewers (MSP roles, cro_service_team,
 * partner) get the plain StatusBadge instead — this component owns its own
 * form state and persists straight to gos_dashboard_step_status on Save, so
 * the detail page just conditionally renders it without owning any state.
 */
export function EditOverviewPanel({
  accountId,
  stepSlug,
  initialStatus,
  initialHeadline,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialStatus: PlaybookStatus;
  initialHeadline: KpiStat | null;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [headlineLabel, setHeadlineLabel] = useState(initialHeadline?.label ?? "");
  const [headlineValue, setHeadlineValue] = useState(initialHeadline?.value ?? "");
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <StatusBadge status={status} />;
  }

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("gos_dashboard_step_status").upsert(
      {
        account_id: accountId,
        step_slug: stepSlug,
        status,
        headline_label: headlineLabel || null,
        headline_value: headlineValue || null,
      },
      { onConflict: "account_id,step_slug" }
    );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Saved.");
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
      <div>
        <label className="text-caption font-semibold text-neutral-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PlaybookStatus)}
          className="block h-9 rounded-md border border-neutral-300 px-2 text-body-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-caption font-semibold text-neutral-600">Headline label</label>
        <Input value={headlineLabel} onChange={(e) => setHeadlineLabel(e.target.value)} className="w-48" />
      </div>
      <div>
        <label className="text-caption font-semibold text-neutral-600">Headline value</label>
        <Input value={headlineValue} onChange={(e) => setHeadlineValue(e.target.value)} className="w-32" />
      </div>
      <Button onClick={save} disabled={saving} size="sm">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
