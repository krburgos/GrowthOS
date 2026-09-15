import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { TOTAL_QUESTION_COUNT } from "@/lib/questionnaire/questions";

/**
 * Client-confirmed (2026-09-15) — full-width Dashboard nudge while the
 * Growth Solution Questionnaire isn't finished. Disappears entirely once
 * complete (the parent decides whether to render this at all); exact
 * copy "Complete your Growth Solution Questionnaire" per the client.
 */
export function GrowthQuestionnaireBanner({ answeredCount }: { answeredCount: number }) {
  const pct = Math.round((answeredCount / TOTAL_QUESTION_COUNT) * 100);

  return (
    <Link
      href="/settings/growth-questionnaire"
      className="flex items-center gap-4 rounded-lg bg-gradient-to-r from-primary-800 to-secondary-700 p-4 text-white transition-opacity hover:opacity-95"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/15">
        <ClipboardList className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">Complete your Growth Solution Questionnaire</p>
        <p className="text-caption text-white/75">
          {answeredCount} of {TOTAL_QUESTION_COUNT} questions answered — takes about 15 minutes to finish.
        </p>
        <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="shrink-0 rounded-md bg-white px-4 py-2 text-body-sm font-semibold text-primary-800">
        Continue →
      </span>
    </Link>
  );
}
