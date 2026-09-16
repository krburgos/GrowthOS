"use client";

import { AlertCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { KpiStat, SuggestionItem, TrackerItem } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TABS = ["Status Report", "Suggestions & Fixes", "Progress Tracker"] as const;
type Tab = (typeof TABS)[number];

const PRIORITY_CLASSES: Record<"high" | "medium" | "low", string> = {
  high: "bg-error-100 text-error-700",
  medium: "bg-warning-100 text-warning-700",
  low: "bg-neutral-100 text-neutral-500",
};

const PRIORITY_OPTIONS: SuggestionItem["priority"][] = ["high", "medium", "low"];

type SuggestionRow = SuggestionItem & { id: string };
type TrackerRow = TrackerItem & { id: string };

/**
 * CRO Leader (cro_admin/cro_advisor) edit surface for a step's status
 * report summary (Task 6). Immediate-persist pattern (matching
 * EditOverviewPanel/EditKpiList) — a single Save button writes straight to
 * gos_dashboard_step_status.status_report_summary. Read-only viewers never
 * mount this; they get the plain paragraph in PlaybookDetailTabs instead.
 */
function EditableSummary({
  accountId,
  stepSlug,
  initialSummary,
}: {
  accountId: string;
  stepSlug: string;
  initialSummary: string | null;
}) {
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_step_status")
      .update({ status_report_summary: summary || null })
      .eq("account_id", accountId)
      .eq("step_slug", stepSlug);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Saved.");
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="h-24 w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-body-sm"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <Button type="button" size="sm" onClick={save} disabled={saving} className="self-end">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

/**
 * The doc's own "GrowthOS Dashboard" sub-shape, only rendered for SEO
 * and GEO (hasDashboardShape is true for those 2 steps, false for the
 * other 12 — see lib/gos-dashboard/playbook.ts). Reads live per-account
 * data from Task 2's getStepDetail. Empty states show when account has
 * zero data entered yet (typical on new accounts).
 *
 * CRO Leader (cro_admin/cro_advisor) editing (Task 6): the Status Report
 * summary gets an explicit Save button (EditableSummary above); Suggestions
 * & Fixes and Progress Tracker use the same immediate-persist add/remove
 * pattern as EditKpiList — insert on add, archived_at update on remove, no
 * batch Save, no hard delete. Read-only viewers (MSP roles, cro_service_team,
 * partner) keep the exact plain rendering from Task 4.
 */
export function PlaybookDetailTabs({
  accountId,
  stepSlug,
  statusReportSummary,
  statusReportStats,
  suggestions,
  tracker,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: SuggestionRow[];
  tracker: TrackerRow[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Status Report");

  const [suggestionRows, setSuggestionRows] = useState<SuggestionRow[]>(suggestions);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<SuggestionItem["priority"]>("medium");
  const [newDetail, setNewDetail] = useState("");

  const [trackerRows, setTrackerRows] = useState<TrackerRow[]>(tracker);
  const [newLabel, setNewLabel] = useState("");
  const [newPercent, setNewPercent] = useState("");

  const addSuggestion = async () => {
    if (!newTitle.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_suggestions")
      .insert({ account_id: accountId, step_slug: stepSlug, title: newTitle, priority: newPriority, detail: newDetail || null })
      .select("id, title, priority, detail")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setSuggestionRows((prev) => [
      ...prev,
      { id: data.id, title: data.title, priority: data.priority as SuggestionItem["priority"], detail: data.detail ?? "" },
    ]);
    setNewTitle("");
    setNewPriority("medium");
    setNewDetail("");
  };

  const removeSuggestion = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_suggestions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setSuggestionRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addTrackerItem = async () => {
    if (!newLabel.trim() || newPercent === "") return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_tracker_items")
      .insert({ account_id: accountId, step_slug: stepSlug, label: newLabel, percent_complete: Number(newPercent) })
      .select("id, label, percent_complete")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setTrackerRows((prev) => [...prev, { id: data.id, label: data.label, percentComplete: data.percent_complete }]);
    setNewLabel("");
    setNewPercent("");
  };

  const removeTrackerItem = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_tracker_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setTrackerRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex border-b border-neutral-100 px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3.5 py-3 text-body-sm font-semibold transition-colors",
              tab === t ? "border-secondary-500 text-primary-900" : "border-transparent text-neutral-400 hover:text-neutral-600"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "Status Report" && (
          <div className="flex flex-col gap-4">
            {canEdit ? (
              <EditableSummary accountId={accountId} stepSlug={stepSlug} initialSummary={statusReportSummary} />
            ) : statusReportSummary ? (
              <p className="text-body-sm text-neutral-600">{statusReportSummary}</p>
            ) : (
              <p className="text-body-sm text-neutral-400">No status report yet.</p>
            )}
            {statusReportStats.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {statusReportStats.map((s) => (
                  <div key={s.label} className="rounded-lg bg-neutral-50 p-3.5">
                    <p className="text-h4 font-bold tabular-nums text-primary-900">{s.value}</p>
                    <p className="text-caption text-neutral-500">{s.label}</p>
                    {s.target && <p className="text-caption text-neutral-400">{s.target}</p>}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {tab === "Suggestions & Fixes" && (
          <div className="flex flex-col gap-2.5">
            {suggestionRows.length > 0 ? (
              suggestionRows.map((s) => (
                <div key={s.id} className="relative flex items-start gap-3 rounded-lg border border-neutral-100 p-3.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-body-sm font-semibold text-neutral-800">{s.title}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold capitalize", PRIORITY_CLASSES[s.priority])}>
                        {s.priority}
                      </span>
                    </div>
                    <p className="text-caption text-neutral-500">{s.detail}</p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeSuggestion(s.id)}
                      className="text-neutral-400 hover:text-error-700"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
            )}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
                <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-48" />
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as SuggestionItem["priority"])}
                  className="h-9 rounded-md border border-neutral-300 px-2 text-body-sm capitalize"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </select>
                <Input placeholder="Detail" value={newDetail} onChange={(e) => setNewDetail(e.target.value)} className="w-56" />
                <Button type="button" variant="secondary" size="sm" onClick={addSuggestion}>
                  + Add Suggestion
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "Progress Tracker" && (
          <div className="flex flex-col gap-4">
            {trackerRows.length > 0 ? (
              trackerRows.map((item) => (
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
                  {canEdit && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeTrackerItem(item.id)}
                      className="mt-0.5 text-neutral-400 hover:text-error-700"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
            )}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
                <Input placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-48" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="%"
                  value={newPercent}
                  onChange={(e) => setNewPercent(e.target.value)}
                  className="h-9 w-20 rounded-md border border-neutral-300 px-2 text-body-sm"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addTrackerItem}>
                  + Add Item
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
