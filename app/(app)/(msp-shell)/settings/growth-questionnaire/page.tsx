import { redirect } from "next/navigation";

/**
 * The Solution Questionnaire moved out of Settings to Strategy (client-confirmed, 2026-09-24).
 *
 * Kept rather than deleted: the Dashboard's setup block, the Command
 * Center's readiness strip, the notification bell and the invite flow all
 * linked here, and so does anything anyone bookmarked. A redirect costs one
 * file; a 404 costs trust.
 */
export default function SettingsQuestionnaireRedirect() {
  redirect("/strategy/solution-questionnaire");
}
