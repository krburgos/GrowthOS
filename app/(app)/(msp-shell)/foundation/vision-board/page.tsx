import type { Metadata } from "next";

import { VisionBoardWizard } from "@/components/settings/vision-board-wizard";
import { VisionPage } from "@/components/vision-board/vision-page";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vision Board — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * Foundation → Vision Board (client-confirmed, 2026-09-24). Answers live in
 * vision_board_responses, one row per account (Backend Schema §6.6b).
 * Direct RLS-scoped read here (hybrid access, no secret involved); the
 * wizard writes back the same way.
 *
 * One route now serves both surfaces, where there used to be two that
 * redirected to each other — a finished board at /vision-board and its
 * editor at /settings/vision-board. A completed board renders the Vision
 * Page; `?edit=1` renders the wizard; an unfinished one renders the wizard
 * regardless, since there is nothing to show yet. That removes a redirect
 * hop and, more to the point, means the document has a single address.
 *
 * Read access is account-wide, which vision_board_responses_select already
 * grants. Only the roles in EDIT_ROLES can actually write.
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
  const [{ data: response }, { data: account }, { data: questionnaire }] = await Promise.all([
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", user.account_id).maybeSingle(),
    supabase.from("accounts").select("id, name, logo_url").eq("id", user.account_id).maybeSingle(),
    supabase.from("growth_questionnaire_responses").select("answers").eq("account_id", user.account_id).maybeSingle(),
  ]);

  const complete = !!response?.completed_at;
  const answers = (response?.answers as Record<string, string | string[] | null>) ?? {};

  if (complete && edit !== "1" && account) {
    return (
      <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 md:p-8">
        <VisionPage account={account} answers={answers} canEdit={canEdit} />
      </main>
    );
  }

  const qAnswers = (questionnaire?.answers as Record<string, unknown>) ?? {};

  return (
    <main className="w-full max-w-[1160px] flex-1 p-6 md:p-8">
      <VisionBoardWizard
        accountId={user.account_id}
        initialAnswers={answers}
        initialComplete={complete}
        canEdit={canEdit}
        exitHref={complete ? "/foundation/vision-board" : "/foundation"}
        icpAnswers={{
          targetMarket: (qAnswers.overview_target_market as string) ?? null,
          focusesOnVerticals: qAnswers.overview_verticals === "yes" ? true : qAnswers.overview_verticals === "no" ? false : null,
          hvcDefined: qAnswers.overview_hvc_defined === "yes" ? true : qAnswers.overview_hvc_defined === "no" ? false : null,
        }}
      />
    </main>
  );
}
