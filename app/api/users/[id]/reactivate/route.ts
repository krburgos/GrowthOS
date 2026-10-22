import { NextResponse, type NextRequest } from "next/server";

import { authorizeUserAction } from "@/lib/users/manage";

/**
 * POST /api/users/[id]/reactivate (client-confirmed, 2026-10-22). Undoes
 * Deactivate: the person signs in again with their existing password and
 * the same role. A removed person comes back by being invited again
 * instead, so this refuses them.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeUserAction(id);
  if ("response" in auth) return auth.response;
  const { admin, target } = auth;

  if (target.removed_at) {
    return NextResponse.json({ error: "This person was removed. Invite their email again to bring them back." }, { status: 400 });
  }

  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  if (banError) return NextResponse.json({ error: banError.message }, { status: 400 });

  const { error: updateError } = await admin.from("users").update({ archived_at: null }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
