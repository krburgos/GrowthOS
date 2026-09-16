import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DutiesList } from "@/components/gos-dashboard/duties-list";
import { KpiGrid } from "@/components/gos-dashboard/kpi-grid";
import { PlaybookDetailTabs } from "@/components/gos-dashboard/playbook-detail-tabs";
import { StepHeader } from "@/components/gos-dashboard/step-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getStepDetail } from "@/lib/gos-dashboard/queries";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const step = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  return { title: step ? `${step.title} - GOS Dashboard - GrowthOS` : "GOS Dashboard - GrowthOS" };
}

/**
 * GOS Dashboard step detail (live, per-account, 2026-09-16). Reads user's
 * account data via getStepDetail (Task 2). SEO and GEO render the 3-tab
 * dashboard shape (Status Report / Suggestions & Fixes / Progress Tracker)
 * when hasDashboardShape is true; all 14 steps render Duties + KPIs.
 * On a new account with zero data, tabs/KPIs show their empty states.
 */
export default async function GosDashboardStepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const step = await getStepDetail(user.account_id, slug);
  if (!step) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 md:p-8">
      <StepHeader step={step} />

      {step.hasDashboardShape && (
        <PlaybookDetailTabs
          statusReportSummary={step.statusReportSummary}
          statusReportStats={step.statusReportStats}
          suggestions={step.suggestions}
          tracker={step.tracker}
        />
      )}

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