import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

export interface MissionStep {
  label: string;
  done: boolean;
  /** What the step means, behind an info tooltip rather than a caption. */
  tip?: string;
  href?: string;
  hrefLabel?: string;
}

/**
 * "Your mission on this card" (client-confirmed, 2026-10-23, approved
 * mockup "ICP & List Building Cards"): the numbered steps that tell a CEO or
 * sales manager what to do on a Mission Card. Each step ticks itself off
 * from real data; the first one not done is the current step.
 */
export function MissionSteps({ steps }: { steps: MissionStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="flex flex-col gap-2.5 border-b border-primary-200 bg-primary-50 px-5 py-3.5">
      <span className="text-caption font-bold uppercase tracking-wide text-primary-700">Your mission on this card</span>
      <ol className={cn("grid grid-cols-1 gap-2.5", steps.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <li
              key={s.label}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex min-h-[50px] items-center gap-2.5 rounded-lg bg-white",
                isCurrent ? "border-2 border-primary-700 px-[11px] py-[9px]" : "border px-3 py-2.5",
                s.done ? "border-success-200" : !isCurrent && "border-neutral-200"
              )}
            >
              <span
                className={cn(
                  "flex size-[26px] shrink-0 items-center justify-center rounded-full text-body-sm font-bold",
                  s.done ? "bg-success-400 text-success-950" : isCurrent ? "bg-primary-700 text-white" : "bg-neutral-100 text-neutral-600"
                )}
              >
                {s.done ? <Check className="size-3.5" aria-label="Done" /> : i + 1}
              </span>
              <span className={cn("min-w-0 text-body font-semibold", s.done || isCurrent ? "text-primary-900" : "text-neutral-600")}>
                {s.label}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {s.href && (
                  <Link href={s.href} className="inline-flex items-center gap-1 text-body-sm font-semibold text-secondary-700 hover:underline">
                    {s.hrefLabel ?? "Open"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                )}
                {s.tip && <InfoTip text={s.tip} label={`About ${s.label}`} />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
