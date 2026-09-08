import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { KpiTiles, type KpiTileData } from "@/components/dashboard/kpi-tiles";
import { PipelineByStage, type StageCount } from "@/components/dashboard/pipeline-by-stage";
import { RecentActivityFeed, type FeedItem } from "@/components/dashboard/recent-activity-feed";
import { TodayTasksPanel, type DueTask } from "@/components/dashboard/today-tasks-panel";
import { getCurrentUser, isCroLeaderRole } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard — GrowthOS" };

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function weekOverWeek(dates: string[], sevenAgo: number, fourteenAgo: number, now: number) {
  const thisWeek = dates.filter((d) => {
    const t = new Date(d).getTime();
    return t >= sevenAgo && t <= now;
  }).length;
  const lastWeek = dates.filter((d) => {
    const t = new Date(d).getTime();
    return t >= fourteenAgo && t < sevenAgo;
  }).length;
  const diff = thisWeek - lastWeek;
  const direction: "up" | "down" | "flat" = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const text = diff === 0 ? "No change" : `${diff > 0 ? "+" : ""}${diff} vs last wk`;
  return { thisWeek, direction, text };
}

/**
 * App Flow §4.3, Implementation Plan Milestone 11 — MSP landing screen.
 * Client-confirmed layout, "Concept B — Command Center" (approved
 * mockup, 2026-09-08): a KPI strip leads the page (the convention most
 * CRM home screens open with) with Tasks Due pulled into a permanently
 * visible highlighted rail on the right rather than the App Flow
 * document's literal top-of-page slot — still the first thing the eye
 * lands on, just via placement/color instead of document order.
 *
 * Per the Implementation Plan's own instruction for this milestone,
 * every number here comes from direct Supabase aggregate queries under
 * RLS — no API route, since none of this touches a secret. "This week"
 * is implemented as a trailing 7-day window (not a Sunday/Monday
 * calendar week, which neither document specifies) compared against
 * the 7 days before that. Campaign Sends stays a "—" placeholder, the
 * same convention already used for Bounced on the Contacts table,
 * since Campaigns (Milestone 10) isn't built yet.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isCroLeaderRole(user.role)) redirect("/cro");

  const supabase = await createClient();

  const now = Date.now();
  const sevenAgo = now - 7 * 86400000;
  const fourteenAgo = now - 14 * 86400000;
  const fourteenAgoIso = new Date(fourteenAgo).toISOString();

  const [
    { data: stageRows },
    { data: opportunityRows },
    { data: recentContacts },
    { data: recentMeetings },
    { data: feedRows },
    { data: taskRows },
  ] = await Promise.all([
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.from("opportunities").select("id, stage_id, created_at").eq("account_id", user.account_id),
    supabase
      .from("contacts")
      .select("id, created_at")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .gte("created_at", fourteenAgoIso),
    supabase
      .from("activities")
      .select("occurred_at")
      .eq("account_id", user.account_id)
      .eq("type", "meeting")
      .is("archived_at", null)
      .gte("occurred_at", fourteenAgoIso),
    supabase
      .from("activities")
      .select("id, type, subject, occurred_at, contacts(full_name), opportunities(name)")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase
      .from("activities")
      .select("id, subject, due_at, contacts(full_name), opportunities(name)")
      .eq("account_id", user.account_id)
      .eq("type", "task")
      .is("completed_at", null)
      .is("archived_at", null)
      .not("due_at", "is", null)
      .order("due_at", { ascending: true })
      .limit(8),
  ]);

  // ---- Pipeline by stage ----
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

  // ---- KPI tiles ----
  const leadsDelta = weekOverWeek((recentContacts ?? []).map((c) => c.created_at), sevenAgo, fourteenAgo, now);
  const oppsDelta = weekOverWeek((opportunityRows ?? []).map((o) => o.created_at), sevenAgo, fourteenAgo, now);
  const meetingsDelta = weekOverWeek((recentMeetings ?? []).map((m) => m.occurred_at), sevenAgo, fourteenAgo, now);

  const kpiTiles: KpiTileData[] = [
    { label: "New Leads this week", value: String(leadsDelta.thisWeek), delta: { direction: leadsDelta.direction, text: leadsDelta.text } },
    { label: "Opportunities created", value: String(oppsDelta.thisWeek), delta: { direction: oppsDelta.direction, text: oppsDelta.text } },
    { label: "Meetings held", value: String(meetingsDelta.thisWeek), delta: { direction: meetingsDelta.direction, text: meetingsDelta.text } },
    { label: "Campaign sends", value: "—", delta: { direction: "flat", text: "Milestone 10" } },
  ];

  // ---- Recent activity ----
  const feedItems: FeedItem[] = (feedRows ?? []).map((row) => {
    const contact = unwrap(row.contacts);
    const opportunity = unwrap(row.opportunities);
    return {
      id: row.id,
      type: row.type,
      subject: row.subject,
      who: contact?.full_name ?? opportunity?.name ?? "—",
      occurred_at: row.occurred_at,
    };
  });

  // ---- Tasks due ----
  const dueTasks: DueTask[] = (taskRows ?? []).map((row) => {
    const contact = unwrap(row.contacts);
    const opportunity = unwrap(row.opportunities);
    return {
      id: row.id,
      subject: row.subject,
      due_at: row.due_at!,
      who: contact?.full_name ?? opportunity?.name ?? "—",
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Dashboard</h1>
        <p className="text-body text-neutral-500">
          Welcome back, {user.full_name.split(" ")[0]} — here&apos;s what&apos;s happening across the account today.
        </p>
      </div>

      <KpiTiles tiles={kpiTiles} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <PipelineByStage stages={stages} />
          <RecentActivityFeed items={feedItems} />
        </div>
        <TodayTasksPanel tasks={dueTasks} />
      </div>
    </main>
  );
}
