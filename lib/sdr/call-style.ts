import type { CallOutcome } from "@/lib/sdr/desk";

/**
 * One colour per call outcome (client-confirmed, 2026-11-02, approved mockup
 * "Call Logs and Scrub List Mockup"), shared by Call Logs and Intel's
 * Calling card so an outcome looks the same everywhere. Design System §9
 * tokens only.
 */
export const CALL_OUTCOME_STYLE: Record<CallOutcome, { bar: string; pill: string }> = {
  meeting_booked: { bar: "var(--color-success-600)", pill: "bg-success-100 text-success-800" },
  connected: { bar: "var(--color-secondary-700)", pill: "bg-secondary-100 text-secondary-800" },
  not_interested: { bar: "var(--color-error-500)", pill: "bg-error-100 text-error-700" },
  voicemail: { bar: "var(--color-primary-400)", pill: "bg-primary-100 text-primary-800" },
  no_answer: { bar: "var(--color-neutral-300)", pill: "bg-neutral-100 text-neutral-600" },
  bad_number: { bar: "var(--color-warning-800)", pill: "bg-warning-100 text-warning-800" },
};

/** Best outcome first: the order of chips, legends and stacked bars (top down). */
export const OUTCOME_ORDER: CallOutcome[] = ["meeting_booked", "connected", "not_interested", "voicemail", "no_answer", "bad_number"];
