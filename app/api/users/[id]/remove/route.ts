import { NextResponse, type NextRequest } from "next/server";

import { BLOCK_SIGN_IN, authorizeUserAction } from "@/lib/users/manage";

/**
 * POST /api/users/[id]/remove (client-confirmed, 2026-10-22). Takes a
 * person off every user list and blocks their sign-in. Not a delete:
 * nothing in GrowthMission is hard-deleted (Backend Schema §2), so their
 * past work keeps their name. Inviting the same email restores them.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeUserAction(id);
  if ("response" in auth) return auth.response;
  const { admin, target } = auth;

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("users")
    .update({ removed_at: now, archived_at: target.archived_at ?? now })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // Ends any session still open, as Deactivate does (Backend Schema §3).
  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOCK_SIGN_IN });
  if (banError) return NextResponse.json({ error: banError.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
