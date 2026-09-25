"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EditTrackerList } from "@/components/gos-dashboard/edit-tracker-list";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { KpiStat, TrackerItem } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TABS = ["Status Report", "Progress Tracker"] as const;
type Tab = (typeof TABS)[number];

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
    // Upsert (matching EditOverviewPanel's pattern) rather than update — a
    // step nobody has touched yet has no gos_dashboard_step_status row, so
    // a plain .update() would match zero rows and silently no-op. Only
    // account_id/step_slug/status_report_summary are in the payload, so on
    // an existing row PostgREST's ON CONFLICT DO UPDATE only sets that one
    // column — status/headline_label/headline_value (owned by
    // EditOverviewPanel) are left untouched.
    const { error } = await supabase.from("gos_dashboard_step_status").upsert(
      {
        account_id: accountId,
        step_slug: stepSlug,
        status_report_summary: summary || null,
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
 * summary gets an explicit Save button (EditableSummary above). Progress
 * Tracker owns its editing (add/remove, immediate persist, read-only
 * fallback) in EditTrackerList, matching the per-surface pattern
 * EditKpiList/EditOverviewPanel established in Task 5, rather than this
 * component owning its state directly. This component just owns tab
 * switching and the Status Report tab.
 *
 * Client-confirmed (2026-09-25): the third tab, Suggestions & Fixes, is
 * gone — it became the TaskList above these tabs, which gives each of those
 * lines an owner, hours, a state and a due date, and appears on all 14
 * steps rather than only the two with this shape.
 */
export function PlaybookDetailTabs({
  accountId,
  stepSlug,
  statusReportSummary,
  statusReportStats,
  tracker,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  tracker: (TrackerItem & { id: string })[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Status Report");

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

        {tab === "Progress Tracker" && (
          <EditTrackerList accountId={accountId} stepSlug={stepSlug} initialTracker={tracker} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
