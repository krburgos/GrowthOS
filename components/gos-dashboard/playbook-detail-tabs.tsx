"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";

import type { KpiStat, SuggestionItem, TrackerItem } from "@/lib/gos-dashboard/playbook";
import { cn } from "@/lib/utils";

const TABS = ["Status Report", "Suggestions & Fixes", "Progress Tracker"] as const;
type Tab = (typeof TABS)[number];

const PRIORITY_CLASSES: Record<"high" | "medium" | "low", string> = {
  high: "bg-error-100 text-error-700",
  medium: "bg-warning-100 text-warning-700",
  low: "bg-neutral-100 text-neutral-500",
};

/**
 * The doc's own "GrowthOS Dashboard" sub-shape, only rendered for SEO
 * and GEO (hasDashboardShape is true for those 2 steps, false for the
 * other 12 — see lib/gos-dashboard/playbook.ts). Reads live per-account
 * data from Task 2's getStepDetail. Empty states show when account has
 * zero data entered yet (typical on new accounts).
 */
export function PlaybookDetailTabs({
  statusReportSummary,
  statusReportStats,
  suggestions,
  tracker,
}: {
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: SuggestionItem[];
  tracker: TrackerItem[];
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
            {statusReportSummary ? (
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
            {suggestions.length > 0 ? (
              suggestions.map((s) => (
                <div key={s.title} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3.5">
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
                </div>
              ))
            ) : (
              <p className="text-body-sm text-neutral-400">Nothing added yet.</p>
            )}
          </div>
        )}

        {tab === "Progress Tracker" && (
          <div className="flex flex-col gap-4">
            {tracker.length > 0 ? (
              tracker.map((item) => (
                <div key={item.label}>
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
        )}
      </div>
    </div>
  );
}
