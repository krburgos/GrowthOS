import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

/**
 * One document on the Strategy index (client-confirmed, 2026-09-24).
 *
 * Deliberately the same card language the Dashboard's setup block uses —
 * status rule, figure, meter, status pill — on white rather than navy, so
 * nothing new has to be learned when someone arrives here from there.
 */
export function StrategyDocCard({
  title,
  href,
  answered,
  total,
  sections,
  complete,
  blurb,
  footNote,
}: {
  title: string;
  href: string;
  answered: number;
  total: number;
  sections: number;
  complete: boolean;
  blurb: string;
  footNote?: string;
}) {
  const status = complete ? "Complete" : answered === 0 ? "Not started" : "In progress";
  const action = complete ? "View" : answered === 0 ? "Start" : "Continue";

  return (
    <section className="relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${complete ? "bg-success-600" : "bg-warning-400"}`} />

      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h2 className="flex-1 text-h4 text-primary-900">{title}</h2>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold uppercase tracking-wide ${
            complete ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-800"
          }`}
        >
          {complete && <Check className="size-3" strokeWidth={3} />}
          {status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <div>
          <p className="mb-1.5 text-caption font-bold uppercase tracking-widest text-neutral-400">Questions answered</p>
          <p
            className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${
              complete ? "text-success-700" : "text-warning-800"
            }`}
          >
            {answered.toLocaleString()} <span className="text-h4 font-semibold text-neutral-400">/ {total}</span>
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full rounded-full ${complete ? "bg-success-600" : "bg-warning-400"}`}
              style={{ width: `${Math.min(100, Math.max((answered / total) * 100, 1))}%` }}
            />
          </div>
        </div>

        <p className="max-w-[46ch] text-body-sm leading-relaxed text-neutral-600">{blurb}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3.5">
        <span className="text-caption text-neutral-400">{footNote ?? `${sections} sections`}</span>
        <Link
          href={href}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-body-sm font-semibold transition-colors ${
            complete
              ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              : "bg-primary-700 text-white hover:bg-primary-800"
          }`}
        >
          {action}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
