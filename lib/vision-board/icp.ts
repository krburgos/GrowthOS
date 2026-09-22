/**
 * The read-only Ideal Customer Profile shown inside the Vision Board's
 * Marketing Strategy step. It is sourced from the account's GrowthOS
 * Solution Questionnaire rather than captured again (client-confirmed,
 * 2026-09-16), so it is a view of someone else's answers, not a field.
 *
 * The type lived in vision-board-summary.tsx until that component was
 * replaced by the Vision Page (2026-09-22); it moved here so the wizard
 * does not depend on a view component for a type.
 */
export interface IcpAnswers {
  targetMarket: string | null;
  focusesOnVerticals: boolean | null;
  hvcDefined: boolean | null;
}
