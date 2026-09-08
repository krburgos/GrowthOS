import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — POST /api/accounts. Session (CRO Admin only).
 * Creates a new MSP accounts row and invites its initial Owner in one
 * multi-step call — service role needed both for the privileged
 * accounts insert (no client-side INSERT policy exists on accounts at
 * all, by design — only ever created here) and for
 * auth.admin.inviteUserByEmail(), same as POST /api/users/invite.
 */
const createAccountSchema = z.object({
  accountName: z.string().trim().min(1),
  ownerEmail: z.string().email(),
  ownerFullName: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: inviter } = await supabase.from("users").select("role").eq("id", authUser.id).single();
  if (!inviter || inviter.role !== "cro_admin") {
    return NextResponse.json({ error: "Only CRO Admin can create MSP accounts." }, { status: 403 });
  }

  const parsed = createAccountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an account name and the new Owner's email/name." }, { status: 400 });
  }
  const { accountName, ownerEmail, ownerFullName } = parsed.data;

  const admin = createAdminClient();

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .insert({ name: accountName })
    .select("id")
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Couldn't create that account — please try again." }, { status: 500 });
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
    data: { account_id: account.id, role: "msp_owner", full_name: ownerFullName },
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/accept-invite`,
  });

  if (inviteError) {
    return NextResponse.json(
      { error: `Account created, but the Owner invite failed: ${inviteError.message}` },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, accountId: account.id });
}
