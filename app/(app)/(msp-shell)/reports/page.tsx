import type { Metadata } from "next";

import { IntelTabs, ProgramBoard } from "@/components/reports/program-board";
import { ReportsBoard } from "@/components/reports/reports-board";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter, parseQuarterKey } from "@/lib/growth-mission/hours";
import { activePrograms, programBoard } from "@/lib/programs/intel";
import { PROGRAM_TAB } from "@/lib/programs/programs";
import { getReportsData } from "@/lib/reports/data";

export const metadata: Metadata = { title: "Intel — GrowthMission" };

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
 * Program Reports (client-confirmed 2026-11-16, approved mockup "Program
 * Reports Mockup"): when CRO Leader has switched programs on for the
 * account, tabs appear — Account (everything above) and one per program
 * (`?tab=tactical&m=2026-10-01`), each showing only published months. An
 * account with no programs sees no tabs at all.
 *
 * Every number is still a direct Supabase read under RLS, scoped to the
 * account (lib/reports/data.ts says why that scoping matters).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; m?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const { q, tab, m } = await searchParams;
  const programs = await activePrograms(user.account_id);
  const chosen = programs.find((p) => PROGRAM_TAB[p.program] === tab) ?? null;
  const tabs =
    programs.length > 0 ? <IntelTabs programs={programs.map((p) => p.program)} active={chosen ? chosen.program : "account"} /> : null;

  if (chosen) {
    const data = await programBoard(user.account_id, chosen.program, chosen.startMonth);
    const month = m && /^\d{4}-\d{2}-01$/.test(m) ? m : null;
    return <ProgramBoard data={data} selected={month} tabs={tabs} />;
  }

  const data = await getReportsData(user.account_id, parseQuarterKey(q) ?? currentQuarter());
  return <ReportsBoard data={data} tabs={tabs} />;
}
