import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { UserRole } from "@/lib/auth/get-current-user";
import { ALL_ROLES, CRO_LEADER_ROLES, MSP_ROLES, PARTNER_ROLES } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — POST /api/users/invite. Session (Owner/Admin for
 * their own account, or CRO Admin for any account). Calls
 * auth.admin.inviteUserByEmail() with account_id/role in metadata; the
 * handle_new_user() trigger (§7.2) copies it into public.users the
 * moment the auth record is created.
 */
const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(ALL_ROLES as [string, ...string[]]),
  // Only meaningful (and required) when a CRO Admin invites into a
  // specific MSP account — Owner/Admin invites are always scoped to
  // their own account, and CRO Leader roles never carry an account_id.
  account_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: inviter } = await supabase
    .from("users")
    .select("role, account_id")
    .eq("id", user.id)
    .single();

  if (!inviter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { email, full_name, account_id } = parsed.data;
  const role = parsed.data.role as UserRole;

  let targetAccountId: string | null;

  if (inviter.role === "cro_admin") {
    if (MSP_ROLES.includes(role)) {
      if (!account_id) {
        return NextResponse.json(
          { error: "account_id is required when inviting an MSP role." },
          { status: 400 }
        );
      }
      targetAccountId = account_id;
    } else if (CRO_LEADER_ROLES.includes(role) || PARTNER_ROLES.includes(role)) {
      // Partner roles carry no account_id, same as CRO Leader — which
      // accounts they can see comes from partner_account_grants,
      // managed separately (POST /api/cro/partner-grants), not at
      // invite time.
      targetAccountId = null;
    } else {
      return NextResponse.json({ error: "Unrecognized role." }, { status: 400 });
    }
  } else if (inviter.role === "msp_owner" || inviter.role === "msp_admin") {
    if (!MSP_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "You cannot invite CRO Leader roles." },
        { status: 403 }
      );
    }
    targetAccountId = inviter.account_id;
  } else {
    return NextResponse.json(
      { error: "You are not authorized to invite users." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Someone who was removed or deactivated keeps their account, so an invite
  // to their email restores it rather than failing as "already registered"
  // (client-confirmed, 2026-10-22). They come back in the role and account
  // this invite names, and get a link to set a password and sign in.
  const { data: existing } = await admin
    .from("users")
    .select("id, account_id, archived_at, removed_at")
    .ilike("email", email.trim())
    .maybeSingle();
  if (existing) {
    if (!existing.archived_at && !existing.removed_at) {
      return NextResponse.json({ error: "That email already has an active account." }, { status: 400 });
    }
    // Only CRO Admin may bring back someone from another account (or the
    // CRO Leader team); an Owner or Admin restores their own people only.
    if (inviter.role !== "cro_admin" && existing.account_id !== targetAccountId) {
      return NextResponse.json({ error: "That email already has an account. Ask CRO Leader to restore it." }, { status: 400 });
    }
    const { error: restoreError } = await admin
      .from("users")
      .update({ role, account_id: targetAccountId, full_name, archived_at: null, removed_at: null })
      .eq("id", existing.id);
    if (restoreError) return NextResponse.json({ error: restoreError.message }, { status: 400 });
    const { error: unbanError } = await admin.auth.admin.updateUserById(existing.id, {
      ban_duration: "none",
      user_metadata: { account_id: targetAccountId, role, full_name },
    });
    if (unbanError) return NextResponse.json({ error: unbanError.message }, { status: 400 });
    const { error: linkError } = await admin.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password`,
    });
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
    return NextResponse.json({ success: true, restored: true });
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { account_id: targetAccountId, role, full_name },
    redirectTo: `${new URL(request.url).origin}/auth/confirm?next=/accept-invite`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
