import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";

import { TOTAL_QUESTION_COUNT } from "@/lib/questionnaire/questions";

/**
 * Client-confirmed (2026-09-15, amended 2026-09-16) — full-width Dashboard
 * nudge for the GOS Solution Questionnaire. Originally disappeared
 * entirely once complete; now stays on the Dashboard permanently, switching
 * to a green "complete" state ({TOTAL} of {TOTAL} answered) instead of
 * vanishing — same rule applied to the Vision Board banner for consistency.
 * Client-confirmed (2026-09-17): in every state the title is just the
 * document's name, the line is just the answered count, and the button
 * always reads "View".
 */
export function GrowthQuestionnaireBanner({
  answeredCount,
  complete,
}: {
  answeredCount: number;
  complete: boolean;
}) {
  const pct = Math.round((answeredCount / TOTAL_QUESTION_COUNT) * 100);

  return (
    <Link
      href="/settings/growth-questionnaire"
      className={
        "flex items-center gap-4 rounded-lg p-4 text-white transition-opacity hover:opacity-95 " +
        (complete ? "bg-gradient-to-r from-success-700 to-success-600" : "bg-gradient-to-r from-primary-800 to-secondary-700")
      }
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/15">
        {complete ? <CheckCircle2 className="size-5" /> : <ClipboardList className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">GOS Solution Questionnaire</p>
        <p className="text-caption text-white/75">
          {answeredCount} of {TOTAL_QUESTION_COUNT} questions answered
        </p>
        <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span
        className={
          "shrink-0 rounded-md bg-white px-4 py-2 text-body-sm font-semibold " +
          (complete ? "text-success-700" : "text-primary-800")
        }
      >
        View →
      </span>
    </Link>
  );
}
