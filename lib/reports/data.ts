import { isCompletedThisQuarter, missionCapacity, type CapacityTask, type CreditAllotment } from "@/lib/growth-mission/capacity";
import { currentQuarter, previousQuarter, quarterKey, type QuarterInfo } from "@/lib/growth-mission/hours";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/team/queries";

/**
 * Reports, quarter by quarter (client-confirmed, 2026-10-14, approved
 * mockup "Reports Redesign"). One quarter drives the page; the one before
 * it is loaded too, for the deltas and the Compare overlay.
 *
 * Every query is scoped to the account explicitly. RLS alone is not
 * enough here: CRO Leader can read every account, so an unscoped count
 * would add up the whole portfolio while they view one MSP.
 *
 * Mission figures for a closed quarter come from
 * growth_mission_quarter_snapshots, locked when the quarter ended. The
 * current quarter is calculated live with the same missionCapacity() as
 * Mission Capacity, so the two pages agree.
 */

export const WEEKS_PER_REPORT_QUARTER = 13;
const DAY_MS = 86_400_000;
/** How far back the quarter picker goes. */
const MAX_QUARTERS = 8;

export interface MissionFigures {
  hoursRequired: number;
  hoursAvailable: number;
  hoursCompleted: number;
  creditsRequired: number;
  creditsUsed: number;
  /** Closed: the balance at close. Current: available now. Null until credits are set. */
  creditsLeft: number | null;
  ordersCompleted: number;
  /** Null for the current quarter, which hasn't ended. */
  ordersCarried: number | null;
}

export interface CampaignRow {
  id: string;
  name: string;
  sent: number;
  openRate: number | null;
  clickRate: number | null;
  bounced: number;
  unsubscribed: number;
}

export interface QuarterReport {
  key: string;
  label: string;
  range: string;
  isCurrent: boolean;
  /** Thirteen weekly counts from the quarter's first day; the last week runs to its end. */
  leadsWeekly: number[];
  weekStarts: string[];
  /** How many of the weeks have begun (13 for a closed quarter). */
  weeksElapsed: number;
  oppsCreated: number;
  revenueMonthly: number[];
  monthLabels: string[];
  dealsWon: number;
  mission: MissionFigures | null;
  campaigns: CampaignRow[];
}

export interface StageCount {
  id: string;
  name: string;
  stage_group: StageGroup;
  count: number;
}

export interface ReportsData {
  /** Newest first, for the picker. */
  quarters: { key: string; label: string; isCurrent: boolean }[];
  selected: QuarterReport;
  previous: QuarterReport | null;
  /** Newest first: the current quarter so far, then every locked quarter. */
  history: (MissionFigures & { key: string; label: string; isCurrent: boolean })[];
  stages: StageCount[];
}

function quarterIndex(q: QuarterInfo) {
  return Number(q.start.slice(0, 4)) * 4 + Math.floor(Number(q.start.slice(5, 7)) / 3);
}

export async function getReportsData(accountId: string, selected: QuarterInfo): Promise<ReportsData> {
  const supabase = await createClient();
  const now = currentQuarter();

  // Lock any quarter that closed since the last scheduled run. Idempotent:
  // it only ever inserts quarters that have no snapshot yet.
  await supabase.rpc("snapshot_closed_quarters", { p_account_id: accountId });

  const { data: account } = await supabase.from("accounts").select("created_at").eq("id", accountId).maybeSingle();
  const first = currentQuarter(new Date(account?.created_at ?? Date.now()));

  // The picker: from the account's first quarter to now, at most eight.
  const quarters: QuarterInfo[] = [];
  for (let q = now; quarterIndex(q) >= quarterIndex(first) && quarters.length < MAX_QUARTERS; q = previousQuarter(q)) {
    quarters.push(q);
  }
  // Never show a quarter outside the picker's range.
  const sel = quarters.find((q) => q.start === selected.start) ?? now;
  const prevInfo = quarterIndex(sel) > quarterIndex(first) ? previousQuarter(sel) : null;
  const from = (prevInfo ?? sel).start;

  const [
    { data: contacts },
    { data: opportunities },
    { data: won },
    { data: stageRows },
    { data: allOpps },
    { data: campaignRows },
    { data: snapshotRows },
    { data: taskRows },
    { data: allotmentRows },
    team,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("created_at")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .gte("created_at", from)
      .lt("created_at", sel.nextStart),
    supabase
      .from("opportunities")
      .select("created_at")
      .eq("account_id", accountId)
      .gte("created_at", from)
      .lt("created_at", sel.nextStart),
    supabase
      .from("opportunities")
      .select("value, closed_at, opportunity_stages!inner(stage_group)")
      .eq("account_id", accountId)
      .eq("opportunity_stages.stage_group", "won")
      .gte("closed_at", from)
      .lt("closed_at", sel.nextStart),
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.from("opportunities").select("stage_id").eq("account_id", accountId),
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("status", "sent")
      .is("archived_at", null)
      .gte("sent_at", sel.start)
      .lt("sent_at", sel.nextStart)
      .order("sent_at", { ascending: false }),
    supabase
      .from("growth_mission_quarter_snapshots")
      .select(
        "quarter_start, hours_required, hours_available, hours_completed, credits_required, credits_used, credits_left, orders_completed, orders_carried"
      )
      .eq("account_id", accountId)
      .order("quarter_start", { ascending: false }),
    supabase
      .from("growth_mission_tasks")
      .select("step_slug, hours, state, due_date, completed_at, delegated")
      .eq("account_id", accountId)
      .is("archived_at", null),
    supabase.from("account_credit_allotments").select("effective_month, monthly_credits").eq("account_id", accountId),
    getTeamMembers(accountId),
  ]);

  // ---- Mission: locked quarters, plus the current one live ----
  const snapshots = new Map<string, MissionFigures>(
    ((snapshotRows ?? []) as Record<string, number | string | null>[]).map((r) => [
      String(r.quarter_start),
      {
        hoursRequired: Number(r.hours_required),
        hoursAvailable: Number(r.hours_available),
        hoursCompleted: Number(r.hours_completed),
        creditsRequired: Number(r.credits_required),
        creditsUsed: Number(r.credits_used),
        creditsLeft: r.credits_left === null ? null : Number(r.credits_left),
        ordersCompleted: Number(r.orders_completed),
        ordersCarried: Number(r.orders_carried),
      },
    ])
  );
  const tasks: CapacityTask[] = ((taskRows ?? []) as (Omit<CapacityTask, "hours"> & { hours: number | string })[]).map(
    (t) => ({ ...t, hours: Number(t.hours) })
  );
  const allotments: CreditAllotment[] = (
    (allotmentRows ?? []) as { effective_month: string; monthly_credits: number | string }[]
  ).map((a) => ({ effective_month: a.effective_month, monthly_credits: Number(a.monthly_credits) }));
  const live = missionCapacity(tasks, team, allotments, now);
  const currentMission: MissionFigures = {
    hoursRequired: live.hours.required,
    hoursAvailable: live.hours.available,
    hoursCompleted: live.hours.completed,
    creditsRequired: live.credits.required,
    creditsUsed: live.credits.used,
    creditsLeft: live.credits.available,
    ordersCompleted: tasks.filter((t) => t.step_slug !== "advocate-dash" && isCompletedThisQuarter(t, now)).length,
    ordersCarried: null,
  };
  const missionFor = (q: QuarterInfo) => (q.start === now.start ? currentMission : (snapshots.get(q.start) ?? null));

  // ---- One quarter's CRM figures ----
  const build = (q: QuarterInfo): QuarterReport => {
    const qStart = new Date(`${q.start}T00:00:00Z`).getTime();
    const qNext = new Date(`${q.nextStart}T00:00:00Z`).getTime();
    const inQ = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= qStart && t < qNext;
    };
    const week = (iso: string) => Math.min(WEEKS_PER_REPORT_QUARTER - 1, Math.floor((new Date(iso).getTime() - qStart) / (7 * DAY_MS)));

    const leadsWeekly = Array.from({ length: WEEKS_PER_REPORT_QUARTER }, () => 0);
    for (const c of contacts ?? []) if (inQ(c.created_at)) leadsWeekly[week(c.created_at)] += 1;

    const months = [0, 1, 2].map((i) => {
      const d = new Date(qStart);
      d.setUTCMonth(d.getUTCMonth() + i);
      return d;
    });
    const revenueMonthly = [0, 0, 0];
    let dealsWon = 0;
    for (const o of won ?? []) {
      if (!inQ(o.closed_at)) continue;
      dealsWon += 1;
      revenueMonthly[new Date(o.closed_at!).getUTCMonth() - months[0].getUTCMonth()] += Number(o.value ?? 0);
    }

    const elapsedDays = Math.floor((Date.now() - qStart) / DAY_MS);
    return {
      key: quarterKey(q),
      label: q.label,
      range: q.range,
      isCurrent: q.start === now.start,
      leadsWeekly,
      weekStarts: leadsWeekly.map((_, i) =>
        new Date(qStart + i * 7 * DAY_MS).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      ),
      weeksElapsed: q.start === now.start ? Math.min(WEEKS_PER_REPORT_QUARTER, Math.floor(elapsedDays / 7) + 1) : WEEKS_PER_REPORT_QUARTER,
      oppsCreated: (opportunities ?? []).filter((o) => inQ(o.created_at)).length,
      revenueMonthly,
      monthLabels: months.map((d) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })),
      dealsWon,
      mission: missionFor(q),
      campaigns: [],
    };
  };

  const selectedReport = build(sel);

  // ---- Campaigns sent in the selected quarter ----
  const ids = (campaignRows ?? []).map((c) => c.id);
  const { data: recipients } =
    ids.length > 0
      ? await supabase.from("campaign_recipients").select("campaign_id, status, open_count, click_count").in("campaign_id", ids)
      : { data: [] as { campaign_id: string; status: string; open_count: number; click_count: number }[] };
  const stats = new Map<string, { total: number; sent: number; opened: number; clicked: number; bounced: number; unsub: number }>();
  for (const r of recipients ?? []) {
    const s = stats.get(r.campaign_id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
    s.total += 1;
    if (r.status === "sent") s.sent += 1;
    if (r.status === "bounced") s.bounced += 1;
    if (r.status === "unsubscribed") s.unsub += 1;
    if ((r.open_count ?? 0) > 0) s.opened += 1;
    if ((r.click_count ?? 0) > 0) s.clicked += 1;
    stats.set(r.campaign_id, s);
  }
  selectedReport.campaigns = (campaignRows ?? []).map((c) => {
    const s = stats.get(c.id) ?? { total: 0, sent: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0 };
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

  // ---- Pipeline as it stands today ----
  const countByStage = new Map<string, number>();
  for (const o of allOpps ?? []) countByStage.set(o.stage_id, (countByStage.get(o.stage_id) ?? 0) + 1);
  const stages: StageCount[] = (stageRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    stage_group: s.stage_group as StageGroup,
    count: countByStage.get(s.id) ?? 0,
  }));

  return {
    quarters: quarters.map((q) => ({ key: quarterKey(q), label: q.label, isCurrent: q.start === now.start })),
    selected: selectedReport,
    previous: prevInfo ? build(prevInfo) : null,
    history: quarters
      .map((q) => {
        const m = missionFor(q);
        return m ? { ...m, key: quarterKey(q), label: q.label, isCurrent: q.start === now.start } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    stages,
  };
}
