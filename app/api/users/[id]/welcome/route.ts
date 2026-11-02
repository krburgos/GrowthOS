import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { inviteExpiresAt } from "@/lib/auth/invite-link";
import { MSP_ROLES } from "@/lib/auth/roles";
import { sendWithFallback } from "@/lib/email/resend-send";
import { welcomeHtml, welcomeSubject, welcomeText } from "@/lib/email/welcome";
import { createClient } from "@/lib/supabase/server";
import { authorizeUserAction } from "@/lib/users/manage";

/**
 * POST /api/users/[id]/welcome (client-confirmed, 2026-11-02, approved
 * mockup "Welcome Email CC"). CRO Admin sends a client user who has never
 * logged in a welcome email with a Set your password link, optionally Cc'ing
 * others. One person per send; no bulk. Sending again replaces the link.
 *
 * The link is a Supabase recovery token (works once, expires with Email OTP
 * Expiration, 1 hour) pointing at /auth/confirm, whose Continue button means
 * a mail scanner opening the link can't use it up. No password is ever put
 * in the email. Sent through Resend from EMAIL_FROM_ADDRESS
 * (growthmission@croleader.com), so replies reach that shared mailbox.
 */
const bodySchema = z.object({
  cc: z.array(z.string().trim().email()).max(20).default([]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeUserAction(id);
  if ("response" in auth) return auth.response;
  const { admin, target } = auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "One of the Cc addresses isn't a valid email." }, { status: 400 });
  }

  if (target.removed_at) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.archived_at) {
    return NextResponse.json({ error: "This person is deactivated. Reactivate them first." }, { status: 400 });
  }

  const [{ data: person }, { data: authData, error: authError }] = await Promise.all([
    admin.from("users").select("email, full_name, role, account_id, accounts(name)").eq("id", id).single(),
    admin.auth.admin.getUserById(id),
  ]);
  if (!person || authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "User not found." }, { status: 404 });
  }

  // Sent from the CRO Leader dashboard's All Users, which lists client users.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (actor?.role !== "cro_admin" || !MSP_ROLES.includes(person.role)) {
    return NextResponse.json({ error: "Only CRO Admin can send a welcome email to a client user." }, { status: 403 });
  }

  const au = authData.user;
  if (au.last_sign_in_at) {
    return NextResponse.json({ error: `${person.full_name} has already logged in.` }, { status: 400 });
  }
  const sent = [au.invited_at, au.confirmation_sent_at].filter((t): t is string => !!t).sort();
  if (
    inviteExpiresAt({
      last_sign_in_at: null,
      email_confirmed_at: au.email_confirmed_at ?? null,
      invite_sent_at: sent.at(-1) ?? null,
    })
  ) {
    return NextResponse.json({ error: `${person.full_name} hasn't accepted their invite yet. Use Resend invite.` }, { status: 400 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email: person.email });
  if (linkError || !link.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "Couldn't create the password link." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=${encodeURIComponent("/reset-password")}`;

  const account = Array.isArray(person.accounts) ? person.accounts[0] : person.accounts;
  const { data: sniper } = await admin
    .from("sniperleads_clients")
    .select("active")
    .eq("account_id", person.account_id ?? "")
    .maybeSingle();
  const email = {
    firstName: person.full_name.trim().split(/\s+/)[0] || person.full_name,
    accountName: (account as { name: string } | null)?.name ?? "your company",
    link: url,
    sniperLeads: !!sniper?.active,
  };

  const from = process.env.EMAIL_FROM_ADDRESS ?? "";
  const cc = [...new Set(parsed.data.cc.map((c) => c.toLowerCase()))].filter((c) => c !== person.email.toLowerCase());
  const { error } = await sendWithFallback({
    fromName: "GrowthMission",
    realAddress: from,
    replyToEmail: from,
    to: person.email,
    cc,
    subject: welcomeSubject(email),
    content: welcomeHtml(email),
    isHtml: true,
    text: welcomeText(email),
    tags: [{ name: "kind", value: "welcome" }],
  });
  if (error) return NextResponse.json({ error: error.message ?? "Couldn't send the email." }, { status: 400 });

  const now = new Date().toISOString();
  await admin.from("users").update({ welcome_sent_at: now }).eq("id", id);
  return NextResponse.json({ success: true, welcome_sent_at: now });
}
