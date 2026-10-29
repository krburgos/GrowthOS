import { NextResponse, type NextRequest } from "next/server";

import { inviteExpiresAt } from "@/lib/auth/invite-link";
import { authorizeUserAction } from "@/lib/users/manage";

/**
 * POST /api/users/[id]/resend-invite (client-confirmed, 2026-10-29,
 * approved mockup "Resend Invite"). Sends a fresh invite email to someone
 * who never accepted theirs, once the previous link has expired. Same
 * actors as deactivate (authorizeUserAction). The new link replaces the old.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeUserAction(id);
  if ("response" in auth) return auth.response;
  const { admin, target } = auth;

  if (target.removed_at) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.archived_at) {
    return NextResponse.json({ error: "This person is deactivated. Reactivate them first." }, { status: 400 });
  }

  const [{ data: person }, { data: authData, error: authError }] = await Promise.all([
    admin.from("users").select("email, full_name, role, account_id").eq("id", id).single(),
    admin.auth.admin.getUserById(id),
  ]);
  if (!person || authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "User not found." }, { status: 404 });
  }
  const au = authData.user;

  const sent = [au.invited_at, au.confirmation_sent_at].filter((t): t is string => !!t).sort();
  const expiresAt = inviteExpiresAt({
    last_sign_in_at: au.last_sign_in_at ?? null,
    email_confirmed_at: au.email_confirmed_at ?? null,
    invite_sent_at: sent.at(-1) ?? null,
  });
  if (!expiresAt) {
    return NextResponse.json({ error: `${person.full_name} has already accepted their invite.` }, { status: 400 });
  }
  if (expiresAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "Their current invite link still works. Try again once it expires." }, { status: 400 });
  }

  // Supabase sends a new invite to someone who exists but never confirmed.
  // The metadata goes again so it carries their current role and account.
  const { error } = await admin.auth.admin.inviteUserByEmail(person.email, {
    data: { account_id: person.account_id, role: person.role, full_name: person.full_name },
    redirectTo: `${new URL(request.url).origin}/auth/confirm?next=/accept-invite`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
