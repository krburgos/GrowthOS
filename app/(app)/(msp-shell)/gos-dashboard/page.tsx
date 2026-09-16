import type { Metadata } from "next";

import { PlaybookCard } from "@/components/gos-dashboard/playbook-card";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getStepOverviews } from "@/lib/gos-dashboard/queries";

export const metadata: Metadata = { title: "GOS Dashboard — GrowthOS" };

/**
 * GOS Dashboard (2026-09-16) — sits directly below Dashboard in the main
 * sidebar, visible to every role. Renders the 14 GrowthOS Playbook steps
 * as a flat grid of clickable cards (client-confirmed: flat, not grouped
 * by phase), each linking to /gos-dashboard/[slug]. Step identity (title,
 * icon, phase, duties) lives in app code at lib/gos-dashboard/playbook.ts;
 * the status pill and headline stat on each card are real per-account data
 * read from the gos_dashboard_* tables (Backend Schema §6.6c).
 */
export default async function GosDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;
  const steps = await getStepOverviews(user.account_id);
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">GOS Dashboard</h1>
        <p className="max-w-[70ch] text-body text-neutral-500">
          The GrowthOS Playbook, tracked step by step — 4 phases, 14 workstreams from SEO and GEO through SDR
          outreach. Click into any card for its status report, duties, and KPIs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {steps.map((step) => (
          <PlaybookCard key={step.slug} step={step} />
        ))}
      </div>
    </main>
  );
}
