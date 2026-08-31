import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Design System §8.11 — Empty States. Centered, neutral-400 icon at 48px,
 * Body-level neutral-500 message, 200px minimum vertical space. Per App
 * Flow §6, plain "No records yet" for ordinary empty lists — no
 * onboarding prompts or sample data. A caller can override `message` for
 * the spec'd exceptions (e.g. the Campaigns "connect an email account
 * first" nudge) and pass `action` for those cases' follow-up control.
 */
export function EmptyState({
  icon: Icon,
  message = "No records yet",
  action,
}: {
  icon: LucideIcon;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-8 text-center">
      <Icon className="size-12 text-neutral-400" strokeWidth={1.5} />
      <p className="text-body text-neutral-500">{message}</p>
      {action}
    </div>
  );
}
