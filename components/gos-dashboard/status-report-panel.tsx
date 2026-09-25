"use client";

import { Download, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { KpiStat } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";

interface StatRow extends KpiStat {
  id: string;
}

/**
 * Status Report (client-confirmed restructure, 2026-09-25).
 *
 * This used to be the first of three tabs, shown only on SEO and GEO.
 * It is now the top of every workstream page, on all 14 — the client's
 * framing is that you read where the workstream stands, then scroll into
 * the tasks that follow from it, so the two sit in that order on one page
 * rather than behind tabs that hide one while you read the other.
 *
 * CRO Leader writes it; everyone else reads it. Content is typed by hand
 * for now (client-confirmed) — pulling figures from an analytics tool was
 * discussed and deliberately left for later.
 *
 * Export is a PDF, matching the Vision Board and Questionnaire exports
 * rather than the Reports spreadsheet: this is a document someone reads,
 * not a dataset someone filters.
 */
export function StatusReportPanel({
  accountId,
  stepSlug,
  stepTitle,
  initialSummary,
  initialStats,
  canEdit,
}: {
  accountId: string;
  stepSlug: string;
  stepTitle: string;
  initialSummary: string | null;
  initialStats: (KpiStat & { id: string })[];
  canEdit: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<StatRow[]>(initialStats);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");

  const hasContent = summary.trim().length > 0 || stats.length > 0;

  const saveSummary = async () => {
    setSaving(true);
    const supabase = createClient();
    // Upsert rather than update: a step nobody has touched has no
    // gos_dashboard_step_status row, so an update would match nothing and
    // silently no-op. Only this one column is in the payload, so the
    // status/headline fields EditOverviewPanel owns are left alone.
    const { error } = await supabase.from("gos_dashboard_step_status").upsert(
      { account_id: accountId, step_slug: stepSlug, status_report_summary: summary || null },
      { onConflict: "account_id,step_slug" }
    );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setEditing(false);
    toast.success("Status report saved.");
  };

  const addStat = async () => {
    if (!label.trim() || !value.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gos_dashboard_status_report_stats")
      .insert({ account_id: accountId, step_slug: stepSlug, label, value, target: target || null })
      .select("id, label, value, target")
      .single();
    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setStats((prev) => [...prev, { id: data.id, label: data.label, value: data.value, target: data.target ?? undefined }]);
    setLabel("");
    setValue("");
    setTarget("");
  };

  const removeStat = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gos_dashboard_status_report_stats")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    setStats((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <h2 className="text-h4 text-primary-900">Status Report</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-caption font-semibold text-secondary-800">
            CRO Leader writes this
          </span>
          {canEdit && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {hasContent && (
            <Button size="sm" asChild>
              <a href={`/api/gos-dashboard/${stepSlug}/export`} download>
                <Download className="mr-1.5 size-4" />
                Export PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              rows={7}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={`Where ${stepTitle} stands right now, and what is holding it back.`}
            />
            <div className="flex justify-end gap-2.5">
              <Button size="sm" variant="secondary" onClick={() => { setSummary(initialSummary ?? ""); setEditing(false); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void saveSummary()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : summary.trim() ? (
          <p className="max-w-[68ch] whitespace-pre-line text-body leading-relaxed text-neutral-700">{summary}</p>
        ) : (
          <p className="text-body-sm text-neutral-400">
            {canEdit
              ? "No status report yet. Write where this workstream stands, then set the tasks that follow from it."
              : "CRO Leader has not written this workstream's status report yet."}
          </p>
        )}

        {(stats.length > 0 || canEdit) && (
          <div className="flex flex-col gap-3">
            {stats.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.id} className="relative rounded-lg border border-neutral-100 bg-neutral-50 p-3.5">
                    <p className="text-h4 font-bold tabular-nums text-primary-900">{s.value}</p>
                    <p className="mt-0.5 text-body-sm text-neutral-500">{s.label}</p>
                    {s.target && <p className="mt-1 text-caption font-medium text-secondary-700">{s.target}</p>}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void removeStat(s.id)}
                        aria-label={`Remove ${s.label}`}
                        className="absolute right-2 top-2 rounded p-1 text-neutral-300 hover:bg-neutral-200 hover:text-error-700"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label"
                  className="h-9 w-full sm:w-52"
                />
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Value"
                  className="h-9 w-full sm:w-32"
                />
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Target (optional)"
                  className="h-9 w-full sm:w-44"
                />
                <Button size="sm" variant="secondary" onClick={() => void addStat()}>
                  Add figure
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
