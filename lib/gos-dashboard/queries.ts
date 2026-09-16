import { createClient } from "@/lib/supabase/server";
import {
  PLAYBOOK_STEPS,
  type KpiStat,
  type PlaybookShape,
  type PlaybookStatus,
  type SuggestionItem,
  type TrackerItem,
} from "@/lib/gos-dashboard/playbook";

export interface StepOverview extends PlaybookShape {
  status: PlaybookStatus;
  headline: KpiStat | null;
}

export interface StepDetail extends StepOverview {
  kpis: KpiStat[];
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: SuggestionItem[];
  tracker: TrackerItem[];
}

export async function getStepOverviews(accountId: string): Promise<StepOverview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gos_dashboard_step_status")
    .select("step_slug, status, headline_label, headline_value")
    .eq("account_id", accountId);

  const bySlug = new Map((data ?? []).map((row) => [row.step_slug, row]));

  return PLAYBOOK_STEPS.map((shape) => {
    const row = bySlug.get(shape.slug);
    return {
      ...shape,
      status: (row?.status as PlaybookStatus) ?? "needs_attention",
      headline:
        row?.headline_label && row?.headline_value
          ? { label: row.headline_label, value: row.headline_value }
          : null,
    };
  });
}

export async function getStepDetail(accountId: string, slug: string): Promise<StepDetail | undefined> {
  const shape = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  if (!shape) return undefined;

  const supabase = await createClient();
  const [{ data: statusRow }, { data: kpiRows }, { data: statRows }, { data: suggestionRows }, { data: trackerRows }] =
    await Promise.all([
      supabase
        .from("gos_dashboard_step_status")
        .select("status, headline_label, headline_value, status_report_summary")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .maybeSingle(),
      supabase
        .from("gos_dashboard_kpis")
        .select("label, value, target")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_status_report_stats")
        .select("label, value, target")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_suggestions")
        .select("title, priority, detail")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_tracker_items")
        .select("label, percent_complete")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
    ]);

  return {
    ...shape,
    status: (statusRow?.status as PlaybookStatus) ?? "needs_attention",
    headline:
      statusRow?.headline_label && statusRow?.headline_value
        ? { label: statusRow.headline_label, value: statusRow.headline_value }
        : null,
    kpis: (kpiRows ?? []).map((r) => ({ label: r.label, value: r.value, target: r.target ?? undefined })),
    statusReportSummary: statusRow?.status_report_summary ?? null,
    statusReportStats: (statRows ?? []).map((r) => ({ label: r.label, value: r.value, target: r.target ?? undefined })),
    suggestions: (suggestionRows ?? []).map((r) => ({
      title: r.title,
      priority: r.priority as SuggestionItem["priority"],
      detail: r.detail ?? "",
    })),
    tracker: (trackerRows ?? []).map((r) => ({ label: r.label, percentComplete: r.percent_complete })),
  };
}
