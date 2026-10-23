import type { ContactRule } from "@/lib/contacts/filters";
import { QUESTIONNAIRE_SECTIONS, isAnswered } from "@/lib/questionnaire/questions";
import type { IcpAnswers } from "@/lib/vision-board/icp";

/**
 * The ICP as something the CRM can act on (client-confirmed, 2026-10-23,
 * approved mockup "ICP & List Building Cards"): which answers make up the
 * ICP, whether two versions of it are the same (for approval), and the
 * Contacts filter rules it turns into (for the fit check and Build ICP
 * list). The answers themselves stay in the Solution Questionnaire.
 */

const ICP_SECTIONS = QUESTIONNAIRE_SECTIONS.filter((s) => s.part === "icp");

/** Every saved key the ICP is made of, its "Other" and detail boxes included. */
export const ICP_KEYS: string[] = [
  "overview_target_market",
  ...ICP_SECTIONS.flatMap((s) =>
    s.questions.flatMap((q) => [q.key, ...(q.other || q.otherOption ? [`${q.key}_other`] : []), ...(q.detail ? [q.detail.key] : [])])
  ),
];

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Only the ICP answers, keys sorted and blanks dropped, so equal answers serialise equally. */
export function icpSnapshot(answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of [...ICP_KEYS].sort()) {
    const v = answers[key];
    if (!isEmpty(v)) out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

/** Whether two answer sets (or snapshots) hold the same ICP. */
export function sameSnapshot(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(icpSnapshot(a)) === JSON.stringify(icpSnapshot(b));
}

/** Every ICP question answered: the card's "Review the profile" step. */
export function icpComplete(answers: Record<string, unknown>): boolean {
  return ICP_SECTIONS.every((s) => s.questions.every((q) => isAnswered(q, answers)));
}

/** The questionnaire's size buckets as employee ranges; null `to` is open-ended. */
const SIZE_BUCKETS: Record<string, { from: number; to: number | null }> = {
  "Less than 10": { from: 1, to: 10 },
  "11-20": { from: 11, to: 20 },
  "21-35": { from: 21, to: 35 },
  "36-75": { from: 36, to: 75 },
  "76-200": { from: 76, to: 200 },
  "Above 200": { from: 201, to: null },
};

/** The smallest range covering every chosen bucket. */
export function sizeRange(buckets: string[]): { from: number | null; to: number | null } {
  const picked = buckets.map((b) => SIZE_BUCKETS[b]).filter(Boolean);
  if (picked.length === 0) return { from: null, to: null };
  return {
    from: Math.min(...picked.map((p) => p.from)),
    to: picked.some((p) => p.to === null) ? null : Math.max(...picked.map((p) => p.to as number)),
  };
}

/** "21–75 employees", "201+ employees", or "" when no size was picked. */
export function sizeLabel(buckets: string[]): string {
  const { from, to } = sizeRange(buckets);
  if (from === null) return "";
  return to === null ? `${from}+ employees` : `${from}–${to} employees`;
}

/** Titles are free text, so each decision maker also matches its spelled-out forms. */
export const TITLE_SYNONYMS: Record<string, string[]> = {
  CEO: ["CEO", "Chief Executive"],
  COO: ["COO", "Chief Operating"],
  CIO: ["CIO", "Chief Information"],
  CTO: ["CTO", "Chief Technology"],
  Owner: ["Owner", "Founder", "President"],
  "IT Director": ["IT Director", "Director of IT"],
};

/** Industries, size and titles as Contacts filter rules; an unanswered one is left out. */
export function icpRules(icp: IcpAnswers): ContactRule[] {
  const rules: ContactRule[] = [];
  const industries = [...icp.industries.filter((i) => i !== "Other"), ...(icp.industriesOther ? [icp.industriesOther] : [])];
  if (industries.length) rules.push({ field: "industry", op: "any", value: industries.join("|") });
  const { from, to } = sizeRange(icp.companySize);
  if (from !== null) rules.push({ field: "employees", op: "between", from: String(from), to: to === null ? "" : String(to) });
  const titles = [...new Set(icp.decisionMakers.flatMap((d) => TITLE_SYNONYMS[d] ?? [d]))];
  if (titles.length) rules.push({ field: "title", op: "any", value: titles.join("|") });
  return rules;
}

/** "Healthcare 21–75", the Build ICP list dialog's starting name. */
export function icpDefaultListName(icp: IcpAnswers): string {
  const { from, to } = sizeRange(icp.companySize);
  const size = from === null ? "" : to === null ? ` ${from}+` : ` ${from}–${to}`;
  return `${icp.industries[0] ?? icp.industriesOther ?? "ICP"}${size}`;
}
