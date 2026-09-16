import type { Metadata } from "next";

import { PlaybookCard } from "@/components/gos-dashboard/playbook-card";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";

export const metadata: Metadata = { title: "GOS Dashboard — GrowthOS" };

/**
 * GOS Dashboard (new, 2026-09-16, mockup only) — sits directly below
 * Dashboard in the main sidebar, visible to every role for this pass
 * (client-confirmed). Renders the 14 GrowthOS Playbook steps as a flat
 * grid of clickable cards (client-confirmed: flat, not grouped by phase),
 * each linking to /gos-dashboard/[slug]. Every stat, status, and tracker
 * value on this page and its detail pages is illustrative sample data —
 * there's no backend table behind this yet, deliberately, since this pass
 * is mockups only (client-confirmed 2026-09-16).
 */
export default function GosDashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">GOS Dashboard</h1>
        <p className="max-w-[70ch] text-body text-neutral-500">
          The GrowthOS Playbook, tracked step by step — 4 phases, 14 workstreams from SEO and GEO through SDR
          outreach. Click into any card for its status report, duties, and KPIs.
        </p>
        <p className="mt-1 text-caption font-semibold uppercase tracking-wide text-warning-700">
          Mockup — sample data, not yet connected to live reporting
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLAYBOOK_STEPS.map((step) => (
          <PlaybookCard key={step.slug} step={step} />
        ))}
      </div>
    </main>
  );
}
