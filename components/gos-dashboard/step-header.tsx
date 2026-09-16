import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PLAYBOOK_ICON } from "@/components/gos-dashboard/icon-map";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { getPhaseName, type PlaybookStep } from "@/lib/gos-dashboard/playbook";

export function StepHeader({ step }: { step: PlaybookStep }) {
  const Icon = PLAYBOOK_ICON[step.icon];

  return (
    <div>
      <Link href="/gos-dashboard" className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-secondary-700 hover:underline">
        <ArrowLeft className="size-3.5" />
        GOS Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
              Step {step.number} · {getPhaseName(step.phase)}
            </p>
            <h1 className="text-h1 text-primary-900">{step.title}</h1>
            {step.responsible && <p className="text-body-sm text-neutral-500">Responsible: {step.responsible}</p>}
            {step.budgetNote && <p className="text-body-sm text-neutral-500">{step.budgetNote}</p>}
          </div>
        </div>
        <StatusBadge status={step.status} />
      </div>
    </div>
  );
}
