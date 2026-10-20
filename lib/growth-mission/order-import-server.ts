import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import { getMemberTaskLoad, getTasksForStep } from "@/lib/growth-mission/queries";
import { parseImportFile, type ParsedFile } from "@/lib/import/parse";
import { getTeamMembers } from "@/lib/team/queries";
import type { TeamMember } from "@/lib/team/members";

export interface OrderImportContext {
  accountId: string;
  userId: string;
  slug: string;
  isCroLeader: boolean;
  team: TeamMember[];
  memberLoad: Record<string, number>;
  existingTitles: string[];
  parsed: ParsedFile;
}

/**
 * What both import routes need, or the response to send instead. Only the
 * roles that can issue Mission Orders may import them (the same set the
 * growth_mission_tasks insert policy allows), and only onto a real Mission
 * Card with orders — AdvocateDash runs on drop-by targets.
 */
export async function loadOrderImport(
  slug: string,
  file: FormDataEntryValue | null
): Promise<{ ctx: OrderImportContext } | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return { error: "Unauthorized", status: 401 };
  if (!HOURS_EDIT_ROLES.includes(user.role)) {
    return { error: "You are not authorized to import mission orders.", status: 403 };
  }
  if (slug === ADVOCATE_DASH_SLUG || !PLAYBOOK_STEPS.some((s) => s.slug === slug)) {
    return { error: "That Mission Card doesn't take mission orders.", status: 404 };
  }
  if (!(file instanceof File)) return { error: "No file uploaded.", status: 400 };

  let parsed: ParsedFile;
  try {
    parsed = await parseImportFile(file);
  } catch (err) {
    return { error: (err as Error).message, status: 400 };
  }

  const [team, memberLoad, tasks] = await Promise.all([
    getTeamMembers(user.account_id),
    getMemberTaskLoad(user.account_id),
    getTasksForStep(user.account_id, slug),
  ]);

  return {
    ctx: {
      accountId: user.account_id,
      userId: user.id,
      slug,
      isCroLeader: user.role === "cro_admin" || user.role === "cro_advisor",
      team,
      memberLoad,
      existingTitles: tasks.filter((t) => t.state !== "complete").map((t) => t.title),
      parsed,
    },
  };
}
