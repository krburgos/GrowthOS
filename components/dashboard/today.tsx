import { ArrowRight, Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import { HeroStat } from "@/components/contacts/contact-detail-body";
import { HERO_PRIMARY_ACTION_CLASS, HeroBand } from "@/components/shell/hero-band";
import type { MissionCapacity } from "@/lib/growth-mission/capacity";
import { SHORT_TITLE, formatWhole, type QuarterInfo } from "@/lib/growth-mission/hours";
import { boxTotal, type KpiSource } from "@/lib/growth-mission/kpi-band";
import type { Readiness } from "@/lib/growth-mission/queries";
import { PRIORITY_CHIP, PRIORITY_LABEL, type Task } from "@/lib/growth-mission/tasks";
import { cn } from "@/lib/utils";

/**
 * Proposal (2026-11-10, UX audit, branch ux/headquarters-today — not on
 * main until approved): Headquarters as a "Today" page. One navy band with
 * the next step (until the three foundations are done) and three figures;
 * a funnel strip that shows how the pieces connect; and the orders that
 * need doing soonest. The full Mission Orders table, Mission Capacity and
 * Mission Progress live on Command Center only.
 */

const FOUNDATIONS = [
  {
    key: "profile" as const,
    label: "Company Profile",
    title: "Finish your Company Profile",
    why: "It's shown across GrowthMission, so it should read correctly everywhere.",
    href: "/settings/company",
  },
  {
    key: "questionnaire" as const,
    label: "Solution Questionnaire",
    title: "Finish your Solution Questionnaire",
    why: "Everything else in GrowthMission reads your Ideal Client Profile from it.",
    href: "/settings/growth-questionnaire",
  },
  {
    key: "visionBoard" as const,
    label: "Vision Board",
    title: "Sign off your Vision Board",
    why: "It sets the goals every Mission Card works toward.",
    href: "/settings/vision-board",
  },
];

export function TodayBand({
  readiness,
  sources,
  capacity,
  quarter,
}: {
  readiness: Readiness;
  sources: KpiSource[];
  capacity: MissionCapacity;
  quarter: QuarterInfo;
}) {
  const done = FOUNDATIONS.filter((f) => readiness[f.key].complete).length;
  const next = FOUNDATIONS.find((f) => !readiness[f.key].complete);
  const openOpps = boxTotal(sources, "interested") + boxTotal(sources, "in_progress") + boxTotal(sources, "quoted");

  return (
    <HeroBand>
      {next && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-caption font-semibold uppercase tracking-wide text-secondary-300">
              Next step · {done} of {FOUNDATIONS.length} foundations done
            </p>
            <h2 className="mt-1 text-h2 text-white">{next.title}</h2>
            <p className="mt-0.5 text-body text-white/75">
              {next.why} {readiness[next.key].done} of {readiness[next.key].total} answered so far.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {FOUNDATIONS.map((f) => {
                const complete = readiness[f.key].complete;
                return (
                  <span
                    key={f.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-caption font-semibold",
                      complete ? "text-white/60" : f.key === next.key ? "text-white" : "text-white/75"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full",
                        complete ? "bg-success-500 text-white" : "border border-white/40"
                      )}
                    >
                      {complete && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {f.label}
                  </span>
                );
              })}
            </div>
          </div>
          <Link href={next.href} className={HERO_PRIMARY_ACTION_CLASS}>
            Continue
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HeroStat label="Prospects" value={boxTotal(sources, "mqc").toLocaleString()} />
        <HeroStat label="Open opportunities" value={openOpps.toLocaleString()} />
        <HeroStat
          label={`Mission hours · ${quarter.label}`}
          value={`${formatWhole(capacity.hours.completed)} of ${formatWhole(capacity.hours.required)}`}
        />
      </div>
    </HeroBand>
  );
}

/** Prospects to Won, each step a link to where those records live. */
export function FunnelStrip({ sources }: { sources: KpiSource[] }) {
  const steps = [
    { label: "MQCs", value: boxTotal(sources, "mqc"), href: "/contacts" },
    { label: "MQLs", value: boxTotal(sources, "mql"), href: "/contacts" },
    { label: "Interested", value: boxTotal(sources, "interested"), href: "/opportunities" },
    { label: "In progress", value: boxTotal(sources, "in_progress"), href: "/opportunities" },
    { label: "Quoted", value: boxTotal(sources, "quoted"), href: "/opportunities" },
    { label: "Won", value: boxTotal(sources, "won"), href: "/opportunities" },
  ];
  return (
    <section className="rounded-xl border border-card-edge bg-white shadow-lift">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">From prospect to won</h2>
        <Link href="/opportunities" className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
          Full board →
        </Link>
      </div>
      <ol className="grid grid-cols-2 gap-px bg-neutral-100 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((s, i) => (
          <li key={s.label} className="bg-white">
            <Link href={s.href} className="group flex h-full items-center gap-2 px-4 py-3 hover:bg-primary-50">
              <span className="min-w-0 flex-1">
                <span className="block text-caption font-semibold uppercase tracking-wide text-neutral-500">{s.label}</span>
                <span
                  className={cn(
                    "block text-h3 font-bold tabular-nums",
                    s.label === "Won" && s.value > 0 ? "text-success-700" : "text-primary-900"
                  )}
                >
                  {s.value.toLocaleString()}
                </span>
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 text-neutral-300 group-hover:text-secondary-700 lg:block" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SHOWN = 5;

/**
 * The open orders that need doing soonest: the signed-in person's own when
 * they hold any, otherwise the account's. Overdue first, then by due date.
 */
export function UpNext({ tasks, myMemberIds }: { tasks: Task[]; myMemberIds: string[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => t.state !== "complete");
  const mine = open.filter((t) => t.assignee && myMemberIds.includes(t.assignee.id));
  const pool = mine.length > 0 ? mine : open;
  const byDue = [...pool].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const rows = byDue.slice(0, SHOWN);
  const overdue = pool.filter((t) => t.due_date !== null && t.due_date < today).length;

  return (
    <section className="rounded-xl border border-card-edge bg-white shadow-lift">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3.5">
        <div>
          <h2 className="text-h4 text-primary-900">{mine.length > 0 ? "Your Mission Orders" : "Mission Orders due soonest"}</h2>
          <p className="text-caption text-neutral-500">
            {pool.length.toLocaleString()} open{overdue > 0 && <span className="font-semibold text-error-600"> · {overdue} overdue</span>}
          </p>
        </div>
        <Link
          href="/growth-mission#mission-orders"
          className="text-caption font-semibold text-secondary-700 hover:text-secondary-800"
        >
          All {open.length.toLocaleString()} on Command Center →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-body-sm text-neutral-500">Nothing open. New Mission Orders appear here as they&apos;re issued.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((t) => {
            const late = t.due_date !== null && t.due_date < today;
            return (
              <li key={t.id}>
                <Link
                  href={`/growth-mission/${t.step_slug}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-primary-50"
                >
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-caption font-semibold", PRIORITY_CHIP[t.priority])}>
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-neutral-800">{t.title}</span>
                    <span className="block truncate text-caption text-neutral-500">
                      {SHORT_TITLE[t.step_slug] ?? t.step_slug}
                      {t.assignee ? ` · ${t.assignee.name}` : t.delegated ? " · GrowthMission" : " · Unassigned"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-body-sm tabular-nums",
                      late ? "font-semibold text-error-600" : "text-neutral-600"
                    )}
                  >
                    {t.due_date
                      ? new Date(`${t.due_date}T00:00:00Z`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })
                      : "No date"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
