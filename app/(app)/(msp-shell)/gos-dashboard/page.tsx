import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";

import { HoursCard } from "@/components/gos-dashboard/hours-card";
import { HoursTotalsStrip } from "@/components/gos-dashboard/hours-totals-strip";
import { KpiBand } from "@/components/gos-dashboard/kpi-band";
import { ReadinessCheck } from "@/components/gos-dashboard/readiness-check";
import { HeroBand, HeroLabel } from "@/components/shell/hero-band";
import { SectionHeading } from "@/components/shell/section-heading";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/gos-dashboard/hours";
import { PLAYBOOK_PHASES } from "@/lib/gos-dashboard/playbook";
import { getKpiBand, getReadiness, getStepHours, getStepOverviews } from "@/lib/gos-dashboard/queries";

export const metadata: Metadata = { title: "GrowthOS Command Center – Strategy & Assignments Dashboard — GrowthOS" };

/**
 * GOS Dashboard (App Flow §4.3a). Client-confirmed (2026-09-17), all from
 * "GrowthOS Playbook - Dev Plan.docx": the "Before You Begin" readiness
 * check, the doc's KPI dashboard band (live contact/opportunity counts),
 * a quarter hours totals strip, and the 14 workstreams as a flat grid of
 * "B — Ledger" hours cards. Hours: MSP Owner/Admin + CRO Admin/Advisor
 * edit; KPI mapping and every step's status/KPIs/report: CRO Admin/Advisor.
 */
export default async function GosDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const quarter = currentQuarter();
  const [steps, hours, kpiBand, readiness] = await Promise.all([
    getStepOverviews(user.account_id),
    getStepHours(user.account_id, quarter.start),
    getKpiBand(user.account_id),
    getReadiness(user.account_id),
  ]);

  const canLogHours = HOURS_EDIT_ROLES.includes(user.role);
  const isCroLeaderEditor = user.role === "cro_admin" || user.role === "cro_advisor";

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <HeroBand>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-h1 text-white">GrowthOS Command Center – Strategy & Assignments Dashboard</h1>
            <p className="max-w-[70ch] text-body text-white/75">
              Tracked by hours — 4 phases, 14 workstreams from SEO through Sales Enablement. Click into any card for
              its status report, duties, and KPIs.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-body-sm font-semibold text-white">
            <CalendarRange className="size-4" />
            {quarter.label} · {quarter.range}
          </span>
        </div>
        <div>
          <HeroLabel>Workstream hours · {quarter.label}</HeroLabel>
          <HoursTotalsStrip hours={Object.values(hours)} quarter={quarter} variant="hero" />
        </div>
      </HeroBand>

      <ReadinessCheck readiness={readiness} />

      <KpiBand
        accountId={user.account_id}
        sources={kpiBand.sources}
        customized={kpiBand.customized}
        canEditMapping={isCroLeaderEditor}
      />

      <section className="mt-2 flex flex-col gap-3">
        <SectionHeading title="Mission Cards">
          <span className="text-caption text-neutral-400">
            {steps.length} workstreams · {PLAYBOOK_PHASES.length} phases
          </span>
        </SectionHeading>

        {!canLogHours && (
          <p className="text-caption text-neutral-400">View only — MSP Owner/Admin and CRO Leader log hours</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {steps.map((step) => (
            <HoursCard
              key={step.slug}
              step={step}
              hours={hours[step.slug]}
              quarter={quarter}
              accountId={user.account_id!}
              canLogHours={canLogHours}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
