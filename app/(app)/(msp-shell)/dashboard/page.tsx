import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PipelineByStage, type StageCount } from "@/components/dashboard/pipeline-by-stage";
import { RecentActivityFeed, type FeedItem } from "@/components/dashboard/recent-activity-feed";
import { SetupBlock } from "@/components/dashboard/setup-block";
import { TodayTasksPanel, type DueTask } from "@/components/dashboard/today-tasks-panel";
import { COMPANY_PROFILE_COLUMNS, type CompanyProfile } from "@/lib/accounts/company-profile";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { currentQuarter } from "@/lib/gos-dashboard/hours";
import { getKpiBand, getStepHours } from "@/lib/gos-dashboard/queries";
import { TOTAL_QUESTION_COUNT, countAnswered } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/team/queries";
import {
  TOTAL_FIELD_COUNT as VISION_BOARD_TOTAL,
  countAnswered as countVisionBoardAnswered,
} from "@/lib/vision-board/sections";

export const metadata: Metadata = { title: "Homepage — GrowthOS" };

/** Same set as Settings › Company (accounts_update RLS, Backend Schema §6.1). */
const PROFILE_EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
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
 * RLS — no API route, since none of this touches a secret.
 *
 * Client-confirmed change (2026-09-22, approved mockup "A"): the hero's
 * "This week" strip — New Leads, Opportunities created, Meetings held
 * and Campaign sends, each with a week-over-week delta — is replaced by
 * the KPI Dashboard band, the same counts the Command Center shows,
 * rendered in the hero's own translucent material. This retires the KPI
 * strip from the approved "Concept B" mockup (App Flow §4.3,
 * Implementation Plan Milestone 11), which was raised with the client
 * before the change: the band is a standing count where the strip was
 * week-over-week movement, so the Homepage no longer reports change
 * over time anywhere. components/dashboard/kpi-tiles.tsx is kept, unused,
 * in case that movement is wanted back.
 *
 * Client-confirmed restructure (2026-09-24, approved mockup "A"): the
 * hero, the Company Profile card and the two full-width document banners
 * all fold into one navy SetupBlock — three panels saying what still
 * needs doing, then workstream hours and the KPI Dashboard saying how
 * things are going. The hours strip is the same component the Command
 * Center uses, shown here too rather than moved.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A CRO Leader/partner role only ever reaches this page once they've
  // entered an MSP account (POST /api/cro/enter) — otherwise /cro is
  // their landing page. Bug fix (2026-09-08): this used to redirect
  // unconditionally for any CRO Leader role, which broke "viewing as"
  // — a CRO Leader who'd already entered an account got bounced right
  // back to /cro instead of seeing that MSP's dashboard.
  if (needsAccountSelection(user.role) && !user.account_id) redirect("/cro");

  const canEditProfile = PROFILE_EDIT_ROLES.includes(user.role);

  const supabase = await createClient();

  const [
    { data: stageRows },
    { data: opportunityRows },
    { data: feedRows },
    { data: taskRows },
    { data: questionnaireResponse },
    { data: visionBoardResponse },
    { data: account },
  ] = await Promise.all([
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.from("opportunities").select("id, stage_id, created_at").eq("account_id", user.account_id),
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
    supabase.from("growth_questionnaire_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", user.account_id).maybeSingle(),
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

  // ---- KPI band and this quarter's hours ----
  const quarter = currentQuarter();
  const [kpiBand, stepHours, teamMembers] = await Promise.all([
    getKpiBand(user.account_id!),
    getStepHours(user.account_id!, quarter.start),
    getTeamMembers(user.account_id!),
  ]);

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

  const questionnaireAnsweredCount = countAnswered(
    (questionnaireResponse?.answers as Record<string, unknown>) ?? {}
  );
  const questionnaireComplete = !!questionnaireResponse?.completed_at;
  const visionBoardAnsweredCount = countVisionBoardAnswered(
    (visionBoardResponse?.answers as Record<string, unknown>) ?? {}
  );
  const visionBoardComplete = !!visionBoardResponse?.completed_at;
  const vbAnswers = (visionBoardResponse?.answers as Record<string, unknown>) ?? {};
  const visionBoardSignOff = {
    name: typeof vbAnswers.signoff_name === "string" ? vbAnswers.signoff_name : null,
    date: typeof vbAnswers.signoff_date === "string" ? vbAnswers.signoff_date : null,
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Homepage</h1>
        <p className="text-body text-neutral-500">
          Welcome back, {user.full_name.split(" ")[0]} — here&apos;s what&apos;s happening across the account today.
        </p>
      </div>

      <SetupBlock
        accountId={user.account_id!}
        account={(account as unknown as CompanyProfile) ?? null}
        canEditProfile={canEditProfile}
        questionnaire={{
          answered: questionnaireAnsweredCount,
          total: TOTAL_QUESTION_COUNT,
          complete: questionnaireComplete,
        }}
        visionBoard={{
          answered: visionBoardAnsweredCount,
          total: VISION_BOARD_TOTAL,
          complete: visionBoardComplete,
          signedBy: visionBoardSignOff.name,
          signedOn: visionBoardSignOff.date,
        }}
        hours={Object.values(stepHours)}
        quarter={quarter}
        kpiSources={kpiBand.sources}
        teamCount={teamMembers.filter((m) => m.kind === "in_house").length}
      />

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
