import type { Metadata } from "next";

import type { StageCount } from "@/components/dashboard/pipeline-by-stage";
import { CampaignPerformanceTable, type CampaignPerformanceRow } from "@/components/reports/campaign-performance-table";
import { LeadsChart, type WeeklyCount } from "@/components/reports/leads-chart";
import { ReportCard } from "@/components/reports/report-card";
import { RevenueBars, type MonthlyRevenue } from "@/components/reports/revenue-bars";
import { StageBars } from "@/components/reports/stage-bars";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports — GrowthOS" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS_BACK = 8;
const MONTHS_BACK = 3;

/**
 * PRD §6.7, App Flow §4.8 (H1) — one shared reporting view for every
 * role (no role-specific dashboards). Client-confirmed "Grid Dashboard"
 * concept (approved mockup, 2026-09-08): all four sections visible at
 * once, compact, no scrolling on a normal desktop. Every number here is
 * a direct Supabase aggregate query under RLS (Backend Schema §11) —
 * revenue in particular is summed straight from opportunities.value,
 * never self-reported (PRD §6.7). Each section's Export button hits
 * GET /api/reports/export?section=..., the one part of this screen
 * that needs a server route (ExcelJS file generation, §10).
 */
export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const now = Date.now();
  const weeksStart = new Date(now - WEEKS_BACK * WEEK_MS).toISOString();

  const [{ data: stageRows }, { data: opportunityRows }, { data: recentContacts }, { data: campaignRows }, { data: wonOpportunities }] =
    await Promise.all([
      supabase
        .from("opportunity_stages")
        .select("id, name, stage_group, sort_order")
        .eq("account_id", user.account_id)
        .is("archived_at", null)
        .order("sort_order"),
      supabase.from("opportunities").select("id, stage_id"),
      supabase.from("contacts").select("id, created_at").is("archived_at", null).gte("created_at", weeksStart),
      supabase
        .from("campaigns")
        .select("id, name")
        .eq("status", "sent")
        .is("archived_at", null)
        .order("sent_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, value, closed_at, opportunity_stages!inner(stage_group)")
        .eq("opportunity_stages.stage_group", "won")
        .not("closed_at", "is", null),
    ]);

  // ---- Opportunities by stage ----
  const countByStage = new Map<string, number>();
  for (const o of opportunityRows ?? []) {
    countByStage.set(o.stage_id, (countByStage.get(o.stage_id) ?? 0) + 1);
  }
  const stages: StageCount[] = (stageRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    stage_group: s.stage_group as StageGroup,
    count: countByStage.get(s.id) ?? 0,
  }));

  // ---- Leads/contacts added, weekly ----
  const weeks: WeeklyCount[] = Array.from({ length: WEEKS_BACK }, (_, i) => {
    const bucketStart = now - (WEEKS_BACK - i) * WEEK_MS;
    const bucketEnd = bucketStart + WEEK_MS;
    const count = (recentContacts ?? []).filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= bucketStart && t < bucketEnd;
    }).length;
    return { label: new Date(bucketStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count };
  });
  const totalLeads = weeks.reduce((sum, w) => sum + w.count, 0);

  // ---- Campaign performance ----
  const campaignIds = (campaignRows ?? []).map((c) => c.id);
  const { data: recipientRows } =
    campaignIds.length > 0
      ? await supabase
          .from("campaign_recipients")
          .select("campaign_id, status, open_count, click_count")
          .in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string; status: string; open_count: number; click_count: number }[] };

  const statsByCampaign = new Map<string, { total: number; sent: number; opened: number; clicked: number; bounced: number; unsub: number }>();
  for (const r of recipientRows ?? []) {
    const s = statsByCampaign.get(r.campaign_id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
    s.total += 1;
    if (r.status === "sent") s.sent += 1;
    if (r.status === "bounced") s.bounced += 1;
    if (r.status === "unsubscribed") s.unsub += 1;
    if ((r.open_count ?? 0) > 0) s.opened += 1;
    if ((r.click_count ?? 0) > 0) s.clicked += 1;
    statsByCampaign.set(r.campaign_id, s);
  }
  const campaigns: CampaignPerformanceRow[] = (campaignRows ?? []).map((c) => {
    const s = statsByCampaign.get(c.id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
    return {
      id: c.id,
      name: c.name,
      sent: s.total,
      openRate: s.sent > 0 ? s.opened / s.sent : null,
      clickRate: s.sent > 0 ? s.clicked / s.sent : null,
      bounced: s.bounced,
      unsubscribed: s.unsub,
    };
  });

  // ---- Revenue from closed-won, monthly ----
  const monthBuckets = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (MONTHS_BACK - 1 - i));
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(undefined, { month: "short" }) };
  });
  const monthlyRevenue: MonthlyRevenue[] = monthBuckets.map((b) => {
    const total = (wonOpportunities ?? [])
      .filter((o) => {
        const d = new Date(o.closed_at!);
        return d.getFullYear() === b.year && d.getMonth() === b.month;
      })
      .reduce((sum, o) => sum + (o.value ?? 0), 0);
    return { label: b.label, total };
  });
  const totalRevenue = (wonOpportunities ?? []).reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Reports</h1>
        <p className="text-body text-neutral-500">Leads, pipeline, campaign performance, and revenue — all from real data, never self-reported.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard title="Leads & Contacts Added" subtitle="Weekly, last 8 weeks" exportHref="/api/reports/export?section=leads">
          <LeadsChart weeks={weeks} total={totalLeads} />
        </ReportCard>

        <ReportCard title="Opportunities by Stage" exportHref="/api/reports/export?section=pipeline">
          <StageBars stages={stages} />
        </ReportCard>

        <ReportCard title="Campaign Performance" exportHref="/api/reports/export?section=campaigns">
          <CampaignPerformanceTable campaigns={campaigns} />
        </ReportCard>

        <ReportCard title="Revenue from Closed-Won" exportHref="/api/reports/export?section=revenue">
          <RevenueBars months={monthlyRevenue} total={totalRevenue} dealCount={(wonOpportunities ?? []).length} />
        </ReportCard>
      </div>
    </main>
  );
}
