import Link from "next/link";

import { PLAYBOOK_ICON } from "@/components/gos-dashboard/icon-map";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { getPhaseName, type PlaybookStep } from "@/lib/gos-dashboard/playbook";

export function PlaybookCard({ step }: { step: PlaybookStep }) {
  const Icon = PLAYBOOK_ICON[step.icon];

  return (
    <Link
      href={`/gos-dashboard/${step.slug}`}
      className="group flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-secondary-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <Icon className="size-5" />
        </span>
        <StatusBadge status={step.status} />
      </div>

      <div className="min-w-0">
        <p className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
          Step {step.number} · {getPhaseName(step.phase)}
        </p>
        <h3 className="mt-0.5 text-body font-semibold text-primary-900">{step.title}</h3>
      </div>

      <div className="mt-auto flex items-baseline justify-between border-t border-neutral-100 pt-3">
        <div>
          <p className="text-h4 font-bold tabular-nums text-primary-900">{step.headline.value}</p>
          <p className="text-caption text-neutral-500">{step.headline.label}</p>
        </div>
        <span className="shrink-0 text-body-sm font-semibold text-secondary-700 group-hover:underline">
          View →
        </span>
      </div>
    </Link>
  );
}
