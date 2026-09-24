import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VisionBoardWizard } from "@/components/settings/vision-board-wizard";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "GrowthOS Vision Board — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * Settings → Account Settings → GrowthOS Vision Board (new, 2026-09-16).
 * Answers live in vision_board_responses, one row per account (Backend
 * Schema §6.6b, same RLS shape as growth_questionnaire_responses).
 * Direct RLS-scoped read here (hybrid access, no secret involved); the
 * wizard itself writes back the same way. The Marketing Strategy step's
 * read-only ICP box also reads growth_questionnaire_responses directly.
 *
 * Client-confirmed (2026-09-22): this route is now the *edit* surface
 * only. A completed board lives at /vision-board, its own full-width
 * page, so landing here with one already finished redirects there -
 * unless ?edit=1 says the visitor arrived by pressing Edit.
 */
export default async function VisionBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const { edit } = await searchParams;

  const canEdit = EDIT_ROLES.includes(user.role);

  const supabase = await createClient();
  const [{ data: response }, { data: questionnaire }] = await Promise.all([
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase
      .from("growth_questionnaire_responses")
      .select("answers")
      .eq("account_id", user.account_id)
      .maybeSingle(),
  ]);

  if (response?.completed_at && edit !== "1") redirect("/vision-board");

  const qAnswers = (questionnaire?.answers as Record<string, unknown>) ?? {};

  return (
    <main className="w-full max-w-[1160px] flex-1 p-6 md:p-8">
      <VisionBoardWizard
        accountId={user.account_id}
        initialAnswers={(response?.answers as Record<string, string | string[] | null>) ?? {}}
        initialComplete={!!response?.completed_at}
        canEdit={canEdit}
        exitHref={response?.completed_at ? "/vision-board" : "/dashboard"}
        icpAnswers={{
          targetMarket: (qAnswers.overview_target_market as string) ?? null,
          focusesOnVerticals: qAnswers.overview_verticals === "yes" ? true : qAnswers.overview_verticals === "no" ? false : null,
          hvcDefined: qAnswers.overview_hvc_defined === "yes" ? true : qAnswers.overview_hvc_defined === "no" ? false : null,
        }}
      />
    </main>
  );
}
