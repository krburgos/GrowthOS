import type { Metadata } from "next";

import { FoundationCard } from "@/components/foundation/foundation-card";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { TOTAL_QUESTION_COUNT, QUESTIONNAIRE_SECTIONS, countAnswered } from "@/lib/questionnaire/questions";
import { COMPANY_PROFILE_COLUMNS, profileCompleteness, type CompanyProfile } from "@/lib/accounts/company-profile";
import { createClient } from "@/lib/supabase/server";
import {
  TOTAL_FIELD_COUNT as VISION_BOARD_TOTAL,
  VISION_BOARD_SECTIONS,
  countAnswered as countVisionBoardAnswered,
} from "@/lib/vision-board/sections";

export const metadata: Metadata = { title: "Foundation — GrowthOS" };

/**
 * Foundation (client-confirmed, 2026-09-24) — a top-level section for the
 * three documents an account must complete before the Command Center will
 * run, moved out of Settings.
 *
 * They were never settings. Settings is where you change configuration;
 * these are written once, read often, exported as PDFs and consumed by
 * other screens — the Command Center's readiness check reads the
 * Questionnaire's ICP answer, and the finished Vision Board is a page you
 * would show a board. The Vision Board had already half-escaped, with its
 * finished view at a top-level route and its editor three levels into
 * Settings; this finishes that move rather than starting a new one.
 *
 * Company Profile deliberately stayed behind: it is the account's own
 * record, changed when the company changes, and belongs beside Billing and
 * Users. It only ever sat with these two because all three appear together
 * on the Dashboard as onboarding steps.
 */
export default async function StrategyPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const supabase = await createClient();
  const [{ data: questionnaire }, { data: visionBoard }, { data: accountRow }] = await Promise.all([
    supabase.from("growth_questionnaire_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", user.account_id).maybeSingle(),
  ]);

  const profile = accountRow
    ? profileCompleteness(accountRow as unknown as CompanyProfile)
    : { filled: 0, total: 11, missing: [] as string[], complete: false };

  const qAnswered = countAnswered((questionnaire?.answers as Record<string, unknown>) ?? {});
  const vAnswered = countVisionBoardAnswered((visionBoard?.answers as Record<string, unknown>) ?? {});
  const vComplete = !!visionBoard?.completed_at;

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Foundation</h1>
        <p className="max-w-[80ch] text-body text-neutral-500">
          The three things GrowthOS needs before it can run your plan. Fill them in once, revisit them each quarter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FoundationCard
          title="Company Profile"
          href="/foundation/company-profile"
          answered={profile.filled}
          total={profile.total}
          sections={0}
          unit="fields complete"
          complete={profile.complete}
          blurb={
            profile.missing.length > 0
              ? `Your company record, shown across GrowthOS. Still missing: ${profile.missing.join(", ")}.`
              : "Your company record, shown across GrowthOS. Every field is filled in."
          }
          footNote="Name, address, logo, CEO and team"
        />
        <FoundationCard
          title="Solution Questionnaire"
          href="/foundation/solution-questionnaire"
          answered={qAnswered}
          total={TOTAL_QUESTION_COUNT}
          sections={QUESTIONNAIRE_SECTIONS.length}
          complete={!!questionnaire?.completed_at}
          blurb="Defines your ideal client profile and positioning. The Command Center's readiness check reads it, and stays blocked until this is done."
        />
        <FoundationCard
          title="Vision Board"
          href="/foundation/vision-board"
          answered={vAnswered}
          total={VISION_BOARD_TOTAL}
          sections={VISION_BOARD_SECTIONS.length}
          complete={vComplete}
          blurb="Ten-year target, core values, the three-year picture and this year's plan."
          footNote={vComplete ? "PDF available" : undefined}
        />
      </div>
    </main>
  );
}
