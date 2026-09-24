import type { Metadata } from "next";

import { GrowthQuestionnaireWizard } from "@/components/settings/growth-questionnaire-wizard";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solution Questionnaire — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

/**
 * Strategy → Solution Questionnaire (moved out of Settings 2026-09-24).
 * Answers live in growth_questionnaire_responses, one row per account
 * (Backend Schema, same RLS shape as contact_statuses). Direct
 * RLS-scoped read here (hybrid access, no secret involved); the wizard
 * itself writes back the same way.
 */
export default async function GrowthQuestionnairePage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const canEdit = EDIT_ROLES.includes(user.role);

  const supabase = await createClient();
  const { data: response } = await supabase
    .from("growth_questionnaire_responses")
    .select("answers")
    .eq("account_id", user.account_id)
    .maybeSingle();

  return (
    <main className="w-full max-w-[900px] flex-1 p-6 md:p-8">
      <GrowthQuestionnaireWizard
        accountId={user.account_id}
        initialAnswers={(response?.answers as Record<string, string | number | null>) ?? {}}
        canEdit={canEdit}
        exitHref="/strategy"
      />
    </main>
  );
}
