import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PipelineByStage, type StageCount } from "@/components/dashboard/pipeline-by-stage";
import { SetupBlock } from "@/components/dashboard/setup-block";
import { COMPANY_PROFILE_COLUMNS, type CompanyProfile } from "@/lib/accounts/company-profile";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import type { StageGroup } from "@/lib/opportunities/stages";
import { MissionOrders } from "@/components/growth-mission/mission-orders";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/growth-mission/hours";
import { getKpiBand, getMissionData, getTasks } from "@/lib/growth-mission/queries";
import { TOTAL_QUESTION_COUNT, countAnswered } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/team/queries";
import {
  TOTAL_FIELD_COUNT as VISION_BOARD_TOTAL,
  countAnswered as countVisionBoardAnswered,
} from "@/lib/vision-board/sections";

export const metadata: Metadata = { title: "Headquarters — GrowthMission" };

/** Same set as Settings › Company (accounts_update RLS, Backend Schema §6.1). */
const PROFILE_EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.3, Implementation Plan Milestone 11 — MSP landing screen.
 * Client-confirmed layout, "Concept B — Command Center" (approved
 * mockup, 2026-09-08).
 *
 * Per the Implementation Plan's own instruction for this milestone,
 * every number here comes from direct Supabase aggregate queries under
 * RLS — no API route, since none of this touches a secret.
 *
 * Client-confirmed change (2026-09-22, approved mockup "A"): the hero's
 * "This week" strip is replaced by the KPI band, the same counts the
 * Command Center shows. components/dashboard/kpi-tiles.tsx is kept,
 * unused, in case week-over-week movement is wanted back.
 *
 * Client-confirmed restructure (2026-09-24, approved mockup "A"): the
 * hero, the Company Profile card and the two document banners fold into
 * one navy SetupBlock — three panels saying what still needs doing, then
 * the hours and the KPI band saying how things are going.
 *
 * Client-confirmed (2026-10-13, approved mockup "Mission Dashboards" v5):
 * the Homepage is renamed Headquarters and moves to /headquarters (the old
 * path redirects, next.config.ts). The setup block shows Mission Capacity
 * and Mission Progress, the same figures as the Command Center. Recent
 * activity and the Today rail are removed, which leaves Opportunities by
 * Stage at full width under the block.
 *
 * Client-confirmed (2026-10-14, approved mockup "Mission Orders Design"):
 * the account-wide Mission Orders table sits below Opportunities by Stage.
 */
export default async function HeadquartersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A CRO Leader/partner role only ever reaches this page once they've
  // entered an MSP account (POST /api/cro/enter) — otherwise /cro is
  // their landing page. Bug fix (2026-09-08): this used to redirect
  // unconditionally for any CRO Leader role, which broke "viewing as"
  // — a CRO Leader who'd already entered an account got bounced right
  // back to /cro instead of seeing that MSP's Headquarters.
  if (needsAccountSelection(user.role) && !user.account_id) redirect("/cro");

  const canEditProfile = PROFILE_EDIT_ROLES.includes(user.role);
  const canSetCredits = user.role === "cro_admin" || user.role === "cro_advisor";

  const supabase = await createClient();
  const quarter = currentQuarter();

  const [
    { data: stageRows },
    { data: opportunityRows },
    { data: questionnaireResponse },
    { data: visionBoardResponse },
    { data: account },
    kpiSources,
    mission,
    teamMembers,
    orders,
  ] = await Promise.all([
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.from("opportunities").select("id, stage_id, created_at").eq("account_id", user.account_id),
    supabase.from("growth_questionnaire_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", user.account_id).maybeSingle(),
    getKpiBand(user.account_id!),
    getMissionData(user.account_id!, quarter),
    getTeamMembers(user.account_id!),
    getTasks(user.account_id!),
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
        <h1 className="text-h1 text-primary-900">Headquarters</h1>
        <p className="text-body text-neutral-500">
          Welcome back, {user.full_name.split(" ")[0]} — here&apos;s what&apos;s happening across the account today.
        </p>
      </div>

      <SetupBlock
        accountId={user.account_id!}
        account={(account as unknown as CompanyProfile) ?? null}
        canEditProfile={canEditProfile}
        canSetCredits={canSetCredits}
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
        capacity={mission.capacity}
        quarter={quarter}
        kpiSources={kpiSources}
        teamCount={teamMembers.filter((m) => m.kind === "in_house").length}
      />

      <PipelineByStage stages={stages} />

      <MissionOrders
        mode="overview"
        accountId={user.account_id!}
        orders={orders}
        team={teamMembers}
        canEdit={HOURS_EDIT_ROLES.includes(user.role)}
        isCroLeader={canSetCredits}
        // Headquarters opens on Must only (client-confirmed, 2026-10-15).
        initialPriorities={["high"]}
      />
    </main>
  );
}
