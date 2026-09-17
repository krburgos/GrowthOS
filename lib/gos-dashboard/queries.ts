import { EMPTY_HOURS, type StepHours } from "@/lib/gos-dashboard/hours";
import { defaultBoxFor, type KpiBoxKey, type KpiSource, type SourceKind } from "@/lib/gos-dashboard/kpi-band";
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
  kpis: (KpiStat & { id: string })[];
  statusReportSummary: string | null;
  statusReportStats: KpiStat[];
  suggestions: (SuggestionItem & { id: string })[];
  tracker: (TrackerItem & { id: string })[];
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
        .select("id, label, value, target")
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
        .select("id, title, priority, detail")
        .eq("account_id", accountId)
        .eq("step_slug", slug)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("gos_dashboard_tracker_items")
        .select("id, label, percent_complete")
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
    kpis: (kpiRows ?? []).map((r) => ({ id: r.id, label: r.label, value: r.value, target: r.target ?? undefined })),
    statusReportSummary: statusRow?.status_report_summary ?? null,
    statusReportStats: (statRows ?? []).map((r) => ({ label: r.label, value: r.value, target: r.target ?? undefined })),
    suggestions: (suggestionRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      priority: r.priority as SuggestionItem["priority"],
      detail: r.detail ?? "",
    })),
    tracker: (trackerRows ?? []).map((r) => ({ id: r.id, label: r.label, percentComplete: r.percent_complete })),
  };
}

export async function getStepHours(accountId: string, quarterStart: string): Promise<Record<string, StepHours>> {
  const supabase = await createClient();
  const [{ data: stepRows }, { data: quarterRows }] = await Promise.all([
    supabase.from("gos_dashboard_step_hours").select("step_slug, needed_hours, outsourced").eq("account_id", accountId),
    supabase
      .from("gos_dashboard_quarter_hours")
      .select("step_slug, committed_hours, achieved_hours")
      .eq("account_id", accountId)
      .eq("quarter_start", quarterStart),
  ]);

  const result: Record<string, StepHours> = {};
  for (const shape of PLAYBOOK_STEPS) result[shape.slug] = { ...EMPTY_HOURS };
  for (const r of stepRows ?? []) {
    const h = result[r.step_slug];
    if (!h) continue;
    h.needed = Number(r.needed_hours);
    h.outsourced = r.outsourced;
  }
  for (const r of quarterRows ?? []) {
    const h = result[r.step_slug];
    if (!h) continue;
    h.committed = Number(r.committed_hours);
    h.achieved = Number(r.achieved_hours);
  }
  return result;
}

export interface KpiBandData {
  sources: KpiSource[];
  /** True once a CRO Leader has saved a mapping; false means the name-matching defaults are in effect. */
  customized: boolean;
}

export async function getKpiBand(accountId: string): Promise<KpiBandData> {
  const supabase = await createClient();
  const [{ data: statuses }, { data: stages }, { data: mappingRows }, { data: counts }] = await Promise.all([
    supabase.from("contact_statuses").select("id, name, sort_order").eq("account_id", accountId).is("archived_at", null).order("sort_order"),
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.from("gos_dashboard_kpi_mapping").select("box, contact_status_id, opportunity_stage_id").eq("account_id", accountId),
    supabase.rpc("gos_dashboard_source_counts", { p_account_id: accountId }),
  ]);

  const countById = new Map<string, number>(
    ((counts ?? []) as { source_id: string; record_count: number }[]).map((c) => [c.source_id, Number(c.record_count)])
  );
  const customized = (mappingRows ?? []).length > 0;
  const savedBox = new Map<string, KpiBoxKey | null>();
  for (const m of mappingRows ?? []) {
    const id = m.contact_status_id ?? m.opportunity_stage_id;
    if (id) savedBox.set(id, (m.box as KpiBoxKey | null) ?? null);
  }
  const boxFor = (id: string, kind: SourceKind, name: string, group?: string) =>
    customized ? (savedBox.get(id) ?? null) : defaultBoxFor(kind, name, group);

  const sources: KpiSource[] = [
    ...(statuses ?? []).map((s) => ({
      id: s.id,
      kind: "contact_status" as const,
      name: s.name,
      count: countById.get(s.id) ?? 0,
      box: boxFor(s.id, "contact_status", s.name),
    })),
    ...(stages ?? []).map((s) => ({
      id: s.id,
      kind: "opportunity_stage" as const,
      name: s.name,
      stageGroup: s.stage_group,
      count: countById.get(s.id) ?? 0,
      box: boxFor(s.id, "opportunity_stage", s.name, s.stage_group),
    })),
  ];
  return { sources, customized };
}

export interface Readiness {
  website: string | null;
  targetMarket: string | null;
}

/** The Playbook doc's "Before You Begin": a functioning website and a written ICP (client-confirmed: the Questionnaire's target market answer). */
export async function getReadiness(accountId: string): Promise<Readiness> {
  const supabase = await createClient();
  const [{ data: account }, { data: questionnaire }] = await Promise.all([
    supabase.from("accounts").select("website").eq("id", accountId).maybeSingle(),
    supabase.from("growth_questionnaire_responses").select("answers").eq("account_id", accountId).maybeSingle(),
  ]);
  const answer = (questionnaire?.answers as Record<string, unknown> | undefined)?.overview_target_market;
  return {
    website: account?.website?.trim() || null,
    targetMarket: typeof answer === "string" && answer.trim() ? answer.trim() : null,
  };
}
