"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { TrackerItem } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";

interface TrackerRow extends TrackerItem {
  id: string;
}

/**
 * CRO Leader (cro_admin/cro_advisor) edit surface for a step's Progress
 * Tracker list (Task 6). Immediate-persist pattern (same as EditKpiList) —
 * no separate Save button, each add/remove writes straight to
 * gos_dashboard_tracker_items. Removal is a soft-delete (archived_at),
 * matching the project-wide no-hard-delete rule. Read-only viewers get the
 * plain list (Task 4's rendering) instead.
 */
export function EditTrackerList({
  accountId,
  stepSlug,
  initialTracker,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  initialTracker: TrackerRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<TrackerRow[]>(initialTracker);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4">
        {rows.length > 0 ? (
          rows.map((item) => (
            <div key={item.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-body-sm font-medium text-neutral-700">{item.label}</p>
                <p className="text-caption font-semibold tabular-nums text-neutral-500">{item.percentComplete}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-success-500"
                  style={{ width: `${item.percentComplete}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
        )}
      </div>
    );
  }

  const add = async () => {
    if (!label.trim() || percent === "") return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_tracker_items")
      .insert({ account_id: accountId, step_slug: stepSlug, label, percent_complete: Number(percent) })
      .select("id, label, percent_complete")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => [...prev, { id: data.id, label: data.label, percentComplete: data.percent_complete }]);
    setLabel("");
    setPercent("");
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_tracker_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 ? (
        rows.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-body-sm font-medium text-neutral-700">{item.label}</p>
                <p className="text-caption font-semibold tabular-nums text-neutral-500">{item.percentComplete}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-success-500"
                  style={{ width: `${item.percentComplete}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => remove(item.id)}
              className="mt-0.5 text-neutral-400 hover:text-error-700"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))
      ) : (
        <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-48" />
        <input
          type="number"
          min={0}
          max={100}
          placeholder="%"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className="h-9 w-20 rounded-md border border-neutral-300 px-2 text-body-sm"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Add Item
        </Button>
      </div>
    </div>
  );
}
