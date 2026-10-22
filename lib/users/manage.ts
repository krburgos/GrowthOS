import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Who may deactivate, reactivate or remove a user (Backend Schema §10,
 * extended 2026-10-22): CRO Admin for anyone, an MSP Owner or Admin for
 * people in their own account, and nobody for themselves. Returns the
 * service-role client to act with, or the response to send instead.
 */
export async function authorizeUserAction(
  targetId: string
): Promise<{ admin: ReturnType<typeof createAdminClient>; target: { id: string; archived_at: string | null; removed_at: string | null } } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: actor } = await supabase.from("users").select("role, account_id").eq("id", user.id).single();
  if (!actor) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  if (targetId === user.id) {
    return { response: NextResponse.json({ error: "You can't change your own access." }, { status: 400 }) };
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, account_id, archived_at, removed_at")
    .eq("id", targetId)
    .single();
  if (!target) return { response: NextResponse.json({ error: "User not found." }, { status: 404 }) };

  const authorized =
    actor.role === "cro_admin" ||
    ((actor.role === "msp_owner" || actor.role === "msp_admin") && actor.account_id === target.account_id);
  if (!authorized) {
    return { response: NextResponse.json({ error: "You are not authorized to change this user." }, { status: 403 }) };
  }

  return { admin: createAdminClient(), target };
}

/** ~100 years: Supabase's documented pattern for an effectively permanent ban. */
export const BLOCK_SIGN_IN = "876000h";
