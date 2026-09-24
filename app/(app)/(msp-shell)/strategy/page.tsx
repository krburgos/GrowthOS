import type { Metadata } from "next";

import { StrategyDocCard } from "@/components/strategy/strategy-doc-card";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { TOTAL_QUESTION_COUNT, QUESTIONNAIRE_SECTIONS, countAnswered } from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/server";
import {
  TOTAL_FIELD_COUNT as VISION_BOARD_TOTAL,
  VISION_BOARD_SECTIONS,
  countAnswered as countVisionBoardAnswered,
} from "@/lib/vision-board/sections";

export const metadata: Metadata = { title: "Strategy — GrowthOS" };

/**
 * Strategy (client-confirmed, 2026-09-24) — a top-level section for the two
 * documents the rest of GrowthOS reads from, moved out of Settings.
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
  const [{ data: questionnaire }, { data: visionBoard }] = await Promise.all([
    supabase.from("growth_questionnaire_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
  ]);

  const qAnswered = countAnswered((questionnaire?.answers as Record<string, unknown>) ?? {});
  const vAnswered = countVisionBoardAnswered((visionBoard?.answers as Record<string, unknown>) ?? {});
  const vComplete = !!visionBoard?.completed_at;

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Strategy</h1>
        <p className="max-w-[80ch] text-body text-neutral-500">
          The two documents the rest of GrowthOS reads from. Fill them in once, revisit them each quarter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StrategyDocCard
          title="Solution Questionnaire"
          href="/strategy/solution-questionnaire"
          answered={qAnswered}
          total={TOTAL_QUESTION_COUNT}
          sections={QUESTIONNAIRE_SECTIONS.length}
          complete={!!questionnaire?.completed_at}
          blurb="Defines your ideal client profile and positioning. The Command Center's readiness check reads it, and stays blocked until this is done."
        />
        <StrategyDocCard
          title="Vision Board"
          href="/strategy/vision-board"
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
