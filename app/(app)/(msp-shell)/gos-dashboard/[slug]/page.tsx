import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DutiesList } from "@/components/gos-dashboard/duties-list";
import { KpiGrid } from "@/components/gos-dashboard/kpi-grid";
import { PlaybookDetailTabs } from "@/components/gos-dashboard/playbook-detail-tabs";
import { StepHeader } from "@/components/gos-dashboard/step-header";
import { StepHoursPanel } from "@/components/gos-dashboard/step-hours-panel";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPlaybookStep, PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";

const LOG_HOURS_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

export function generateStaticParams() {
  return PLAYBOOK_STEPS.map((step) => ({ slug: step.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const step = getPlaybookStep(slug);
  return { title: step ? `${step.title} — GOS Dashboard — GrowthOS` : "GOS Dashboard — GrowthOS" };
}

/**
 * GOS Dashboard step detail (new, 2026-09-16, mockup only). SEO and GEO
 * get the doc's own "GrowthOS Dashboard" 3-tab shape (Status Report /
 * Suggestions & Fixes / Progress Tracker) — client-confirmed (2026-09-16)
 * the other 12 steps skip the tabs and go straight to Duties + KPIs,
 * matching what the source doc actually specifies for them. All sample
 * data (lib/gos-dashboard/playbook.ts) — nothing here reads or writes a
 * real table.
 */
export default async function GosDashboardStepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const step = getPlaybookStep(slug);
  if (!step) notFound();
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 md:p-8">
      <StepHeader step={step} />

      <StepHoursPanel slug={step.slug} canLogHours={!!user && LOG_HOURS_ROLES.includes(user.role)} />

      {step.dashboard && <PlaybookDetailTabs dashboard={step.dashboard} />}

      <div>
        <h2 className="mb-3 text-h4 text-primary-900">Duties</h2>
        <DutiesList duties={step.duties} />
      </div>

      <div>
        <h2 className="mb-3 text-h4 text-primary-900">KPIs</h2>
        <KpiGrid kpis={step.kpis} />
      </div>
    </main>
  );
}
