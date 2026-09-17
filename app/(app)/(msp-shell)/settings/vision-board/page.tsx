import type { Metadata } from "next";

import { VisionBoardWizard } from "@/components/settings/vision-board-wizard";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "GOS Vision Board — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * Settings → Account Settings → GOS Vision Board (new, 2026-09-16).
 * Answers live in vision_board_responses, one row per account (Backend
 * Schema §6.6b, same RLS shape as growth_questionnaire_responses).
 * Direct RLS-scoped read here (hybrid access, no secret involved); the
 * wizard itself writes back the same way. The Marketing Strategy step's
 * read-only ICP box also reads growth_questionnaire_responses directly.
 */
export default async function VisionBoardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

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

  const qAnswers = (questionnaire?.answers as Record<string, unknown>) ?? {};

  return (
    <main className="w-full max-w-[1160px] flex-1 p-6 md:p-8">
      <VisionBoardWizard
        accountId={user.account_id}
        initialAnswers={(response?.answers as Record<string, string | string[] | null>) ?? {}}
        initialComplete={!!response?.completed_at}
        canEdit={canEdit}
        exitHref="/dashboard"
        icpAnswers={{
          targetMarket: (qAnswers.overview_target_market as string) ?? null,
          focusesOnVerticals: qAnswers.overview_verticals === "yes" ? true : qAnswers.overview_verticals === "no" ? false : null,
          hvcDefined: qAnswers.overview_hvc_defined === "yes" ? true : qAnswers.overview_hvc_defined === "no" ? false : null,
        }}
      />
    </main>
  );
}
