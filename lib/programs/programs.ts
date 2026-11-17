/**
 * CRO Leader programs an account can subscribe to (client-confirmed
 * 2026-11-16, approved mockup "Program Reports Mockup"). Each one switched on
 * in account_programs gets its own tab in the client's Intel. ScoutLeads,
 * ConquerLeads and NationBuilder join this list once their reports exist.
 */
export const PROGRAMS = ["sniper_leads", "tactical_leads"] as const;
export type Program = (typeof PROGRAMS)[number];

export const PROGRAM_LABEL: Record<Program, string> = {
  sniper_leads: "SniperLeads",
  tactical_leads: "TacticalLeads",
};

/** URL slug for the Intel tab (`/reports?tab=tactical`). */
export const PROGRAM_TAB: Record<Program, string> = {
  sniper_leads: "sniper",
  tactical_leads: "tactical",
};

export interface ProgramSetting {
  program: Program;
  startMonth: string;
  active: boolean;
}

/** "2026-10-01" → "Sep" style short month, and the month before a key. */
export function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
