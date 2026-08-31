import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — POST /api/users/[id]/deactivate. Session
 * (Owner/Admin/CRO Admin). Sets archived_at AND revokes the target
 * user's active sessions via the Auth Admin API — §3 is explicit that
 * archived_at alone doesn't cut off a still-valid JWT. `ban_duration` is
 * the mechanism Supabase's Admin API actually exposes for this (there's
 * no separate "revoke all sessions by user id" call in this client
 * version); a long ban is the documented way to force this.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: actor } = await supabase
    .from("users")
    .select("role, account_id")
    .eq("id", user.id)
    .single();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, account_id")
    .eq("id", targetId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const authorized =
    actor.role === "cro_admin" ||
    ((actor.role === "msp_owner" || actor.role === "msp_admin") &&
      actor.account_id === target.account_id);

  if (!authorized) {
    return NextResponse.json(
      { error: "You are not authorized to deactivate this user." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("users")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", targetId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // ~100 years — Supabase's own documented pattern for an effectively
  // permanent ban, since there's no explicit reactivation flow in Phase 1.
  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: "876000h",
  });

  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
