import type { Metadata } from "next";

import { ReportsBoard } from "@/components/reports/reports-board";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter, parseQuarterKey } from "@/lib/growth-mission/hours";
import { getReportsData } from "@/lib/reports/data";

export const metadata: Metadata = { title: "Reports — GrowthMission" };

/**
 * PRD §6.7, App Flow §4.8 (H1) — one shared reporting view for every role.
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "Reports
 * Redesign"), superseding the 2026-09-08 "Grid Dashboard": a quarter picker
 * (`?q=2026-Q3`) drives every section, the quarter before it is loaded for
 * comparison, and a Mission section shows quarter history with closed
 * quarters' figures locked (growth_mission_quarter_snapshots). Each section
 * keeps its own Export button, which now follows the chosen quarter.
 *
 * Every number is still a direct Supabase read under RLS, scoped to the
 * account (lib/reports/data.ts says why that scoping matters).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const { q } = await searchParams;
  const data = await getReportsData(user.account_id, parseQuarterKey(q) ?? currentQuarter());

  return <ReportsBoard data={data} />;
}
